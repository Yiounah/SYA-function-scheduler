from __future__ import annotations

import json
import os
import tempfile
import unittest
from pathlib import Path

os.environ["SYA_OPENAI_API_KEY"] = ""

from fastapi.testclient import TestClient

from app.config import get_settings

get_settings.cache_clear()

from app.main import app


def tree(leaf: str = "leaf") -> dict:
    def node(task_id: str, children: list[dict] | None = None) -> dict:
        return {
            "task_id": task_id,
            "title": task_id,
            "description": "",
            "estimated_time": 0.5,
            "children": children or [],
        }

    return node("goal", [node("stage", [node("task", [node(leaf)])])])


class PlanBridgeTests(unittest.TestCase):
    def setUp(self) -> None:
        self._directory = tempfile.TemporaryDirectory()
        os.environ["SYA_SCHEDULER_DATA_DIR"] = self._directory.name
        self.client_ctx = TestClient(app)
        self.client = self.client_ctx.__enter__()

    def tearDown(self) -> None:
        if getattr(self.client_ctx, "portal", None) is not None:
            self.client_ctx.__exit__(None, None, None)
        os.environ.pop("SYA_SCHEDULER_DATA_DIR", None)
        self._directory.cleanup()

    def test_preview_does_not_save_when_the_model_is_unavailable(self) -> None:
        response = self.client.post("/api/scheduler/plans/preview", json={"input": "????"})
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["error"]["code"], "MODEL_UNAVAILABLE")
        self.assertEqual(self.client.get("/api/v1/projects").json()["projects"], [])
        self.assertFalse((Path(self._directory.name) / "planner.json").exists())

    def test_confirm_persists_the_tree_and_routine(self) -> None:
        saved = self.client.post("/api/scheduler/plans/confirm", json={"tree": tree()})
        self.assertEqual(saved.status_code, 200)
        self.assertTrue(saved.json()["ok"])
        listed = self.client.get("/api/scheduler/tasks").json()["data"]
        self.assertTrue(any(task["id"] == "leaf" for task in listed))
        updated = self.client.put(
            "/api/scheduler/config",
            json={"workStart": "10:00", "workEnd": "16:00", "dailyGranularity": "fine"},
        )
        self.assertEqual(updated.status_code, 200)
        self.client_ctx.__exit__(None, None, None)
        self.client_ctx = TestClient(app)
        self.client = self.client_ctx.__enter__()
        again = self.client.get("/api/scheduler/tasks").json()["data"]
        self.assertTrue(any(task["id"] == "leaf" for task in again))
        config = self.client.get("/api/scheduler/config").json()["data"]
        self.assertEqual(config["workStart"], "10:00")
        self.assertEqual(config["workEnd"], "16:00")
        self.assertEqual(config["dailyGranularity"], "fine")

    def test_granularity_preview_waits_for_commit(self) -> None:
        self.client.post("/api/scheduler/plans/confirm", json={"tree": tree()})
        before = self.client.get("/api/scheduler/tasks").json()["data"]
        preview = self.client.post(
            "/api/scheduler/granularity/preview",
            json={"taskId": "leaf", "level": "finer", "reason": "monitor-yellow", "focusSessionId": "session-1"},
        )
        self.assertEqual(preview.status_code, 200)
        draft_id = preview.json()["data"]["draftId"]
        after = self.client.get("/api/scheduler/tasks").json()["data"]
        self.assertEqual([(task["id"], task["title"]) for task in after], [(task["id"], task["title"]) for task in before])
        rejected = self.client.post(
            f"/api/scheduler/plans/{draft_id}/commit",
            json={"expectedRevision": 0, "requestId": "once"},
        )
        self.assertEqual(rejected.status_code, 409)
        accepted = self.client.post(
            f"/api/scheduler/plans/{draft_id}/commit",
            json={"expectedRevision": 1, "requestId": "once"},
        )
        self.assertEqual(accepted.status_code, 200)
        repeated = self.client.post(
            f"/api/scheduler/plans/{draft_id}/commit",
            json={"expectedRevision": 1, "requestId": "once"},
        )
        self.assertEqual(repeated.json()["data"]["revision"], accepted.json()["data"]["revision"])
        tasks = self.client.get("/api/scheduler/tasks").json()["data"]
        self.assertEqual(len(tasks), len(before) + 1)
        self.assertTrue(any(" · Part " in task["title"] for task in tasks))

    def test_routine_preview_and_ranged_timeline_do_not_write(self) -> None:
        self.client.post("/api/scheduler/plans/confirm", json={"tree": tree("read-me")})
        path = Path(self._directory.name) / "planner.json"
        before = path.read_text(encoding="utf-8")
        routine = self.client.post(
            "/api/scheduler/routine/preview",
            json={"workStart": "09:00", "workEnd": "12:00", "projectId": json.loads(before)["projects"][0]["voyage"]["voyage_id"]},
        )
        self.assertEqual(routine.status_code, 200)
        self.assertEqual(routine.json()["data"]["affectedTasks"][0]["title"], "read-me")
        timeline = self.client.get("/api/scheduler/timeline", params={"view": "day", "from": "2026-10-20"})
        self.assertEqual(timeline.status_code, 200)
        self.assertIn("events", timeline.json()["data"])
        self.assertEqual(path.read_text(encoding="utf-8"), before)

    def test_routine_and_today_grain_reload_from_the_shared_file(self) -> None:
        saved = self.client.put(
            "/api/scheduler/config",
            json={
                "workStart": "10:00",
                "workEnd": "16:00",
                "todayGrain": {"date": "2026-10-21", "level": "fine"},
                "focusflow": {"hoursPerDay": 4, "periodStart": 600, "periodEnd": 960, "dayGrain": {"2026-10-21": "fine"}},
            },
        )
        self.assertEqual(saved.status_code, 200)
        self.client_ctx.__exit__(None, None, None)
        self.client_ctx = TestClient(app)
        self.client = self.client_ctx.__enter__()
        config = self.client.get("/api/scheduler/config").json()["data"]
        self.assertEqual(config["workStart"], "10:00")
        self.assertEqual(config["workEnd"], "16:00")
        self.assertEqual(config["todayGrain"]["level"], "fine")
        self.assertEqual(config["focusflow"]["hoursPerDay"], 4)
        self.assertEqual(config["focusflow"]["dayGrain"]["2026-10-21"], "fine")

    def test_tree_can_select_a_project(self) -> None:
        self.client.post("/api/scheduler/plans/confirm", json={"tree": tree()})
        projects = self.client.get("/api/v1/projects").json()["projects"]
        selected = self.client.get("/api/v1/tasks/tree", params={"projectId": projects[0]["voyage_id"]})
        self.assertEqual(selected.status_code, 200)
        self.assertEqual(selected.json()["projectId"], projects[0]["voyage_id"])
        self.assertIn("revision", selected.json())
