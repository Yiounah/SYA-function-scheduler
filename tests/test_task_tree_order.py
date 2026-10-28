"""Task-tree moves must survive restart without disturbing execution history."""
from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

os.environ["SYA_OPENAI_API_KEY"] = ""

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api import register_routes
from app.main import lifespan


def application():
    app = FastAPI(lifespan=lifespan)
    register_routes(app)
    return app


def task_tree(prefix):
    def node(task_id, children=None):
        return {"task_id": task_id, "title": task_id, "estimated_time": .1, "children": children or []}

    return node(prefix, [
        node(f"{prefix}-stage-{stage}", [
            node(f"{prefix}-task-{stage}-{task}", [
                node(f"{prefix}-leaf-{stage}-{task}-{leaf}") for leaf in range(4)
            ]) for task in range(2)
        ]) for stage in range(2)
    ])


def nodes(tree):
    yield tree
    for child in tree["children"]:
        yield from nodes(child)


class TaskTreeOrderTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.environment = patch.dict(os.environ, {"SYA_SCHEDULER_DATA_DIR": self.directory.name, "SYA_OPENAI_API_KEY": ""})
        self.environment.start()
        self.start()

    def start(self):
        self.app = application()
        self.client = TestClient(self.app)
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.environment.stop()
        self.directory.cleanup()

    def create(self, name):
        response = self.client.post("/api/scheduler/plans/confirm", json={"tree": task_tree(name)})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()["data"]

    def projects(self):
        return self.client.get("/api/v1/projects").json()["projects"]

    def slots(self):
        return self.client.get("/api/scheduler/timeline", params={"projectId": "all"}).json()["data"]["events"]

    def reorder(self, ids):
        return self.client.post("/api/scheduler/tasks/reorder", json={"taskIds": ids})

    def disk(self):
        return (Path(self.directory.name) / "planner.json").read_bytes()

    def test_all_levels_preserve_progress_active_project_and_slots_after_restart(self):
        self.create("first")
        protected = {"first-leaf-0-0-0", "first-leaf-0-0-1"}
        for task_id, status in zip(sorted(protected), ["completed", "in_progress"]):
            updated = self.client.put(f"/api/scheduler/tasks/{task_id}", json={"status": status, "actualMinutes": 4})
            self.assertEqual(updated.status_code, 200, updated.text)
        second = self.create("second")
        before = self.projects()
        metadata = {n["task_id"]: {k: v for k, v in n.items() if k != "children"} for n in nodes(before[0]["tree"])}
        history = [s for s in self.slots() if s.get("taskId") in protected or s.get("afterTaskId") in protected]
        draft = self.client.post("/api/scheduler/granularity/preview", json={"taskId": "first", "level": "finer"}).json()["data"]
        orders = [
            ["first-stage-1", "first-stage-0"],
            ["first-task-0-1", "first-task-0-0"],
            [f"first-leaf-0-0-{i}" for i in reversed(range(4))],
        ]
        for offset, ids in enumerate(orders, 1):
            response = self.reorder(ids)
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual(response.json(), {"ok": True, "data": None, "error": None})
            current = self.projects()
            self.assertEqual(current[0]["revision"], before[0]["revision"] + offset)
            parent = next(n for n in nodes(current[0]["tree"]) if {c["task_id"] for c in n["children"]} == set(ids))
            self.assertEqual([c["task_id"] for c in parent["children"]], ids)
            self.assertEqual(current[1]["tree"], before[1]["tree"])
            self.assertEqual(self.client.get("/api/v1/tasks/tree").json()["projectId"], second["projectId"])

        stale = self.client.post(f"/api/scheduler/plans/{draft['draftId']}/commit", json={"expectedRevision": draft["baseRevision"], "requestId": "before-move"})
        self.assertEqual(stale.status_code, 409)
        self.assertEqual(stale.json()["error"]["code"], "STALE_DRAFT")
        after = self.projects()
        self.assertEqual({n["task_id"]: {k: v for k, v in n.items() if k != "children"} for n in nodes(after[0]["tree"])}, metadata)
        slots = self.slots()
        self.assertEqual([s for s in slots if s.get("taskId") in protected or s.get("afterTaskId") in protected], history)
        pending_order = [n["task_id"] for n in nodes(after[0]["tree"]) if not n["children"] and n["task_id"] not in protected]
        self.assertEqual([s["taskId"] for s in slots if s.get("taskId") in pending_order], pending_order)

        saved = self.disk()
        self.assertEqual(self.reorder(orders[-1]).status_code, 200)
        self.assertEqual(self.disk(), saved, "Repeating an order must not invalidate unrelated drafts")
        self.client.__exit__(None, None, None)
        self.start()
        self.assertEqual(self.projects(), after)
        self.assertEqual(self.slots(), slots)
        self.assertEqual(self.client.get("/api/v1/tasks/tree").json()["projectId"], second["projectId"])

    def test_invalid_orders_are_inert_for_every_project_and_revision(self):
        self.create("first")
        self.create("second")
        before = self.projects()
        saved = self.disk()
        slots = self.slots()
        for ids in [
            [],
            ["first"],
            ["first-stage-0"],
            ["first-stage-0", "first-stage-0"],
            ["first-stage-0", "missing"],
            ["first-stage-0", "second-stage-0"],
            ["first-stage-0", "first-task-0-0"],
            ["first-task-0-0", "first-task-1-0"],
            ["first-leaf-0-0-0", "first-leaf-0-1-0"],
            [f"first-leaf-0-0-{i}" for i in range(3)],
        ]:
            with self.subTest(ids=ids):
                self.assertEqual(self.reorder(ids).status_code, 422)
                self.assertEqual(self.projects(), before)
                self.assertEqual(self.slots(), slots)
                self.assertEqual(self.disk(), saved)

    def test_failed_save_rolls_back_order_and_revision_then_allows_retry(self):
        first = self.create("first")
        self.create("second")
        activated = self.client.put("/api/scheduler/tasks/first-leaf-0-0-0", json={"status": "in_progress"})
        self.assertEqual(activated.status_code, 200, activated.text)
        before = self.projects()
        slots = self.slots()
        saved = self.disk()
        ids = ["first-stage-1", "first-stage-0"]
        with patch.object(self.app.state.container.planner_desk, "save", side_effect=OSError("disk full")):
            response = self.reorder(ids)
        self.assertEqual(response.status_code, 503, response.text)
        self.assertEqual(self.projects(), before)
        self.assertEqual(self.client.get("/api/v1/tasks/tree").json()["projectId"], first["projectId"])
        self.assertEqual(self.slots(), slots)
        self.assertEqual(self.disk(), saved)
        self.assertEqual(self.reorder(ids).status_code, 200)
        self.assertEqual([n["task_id"] for n in self.projects()[0]["tree"]["children"]], ids)

    def test_disclosure_metadata_keeps_active_project_and_calendar_and_refreshes_other_process(self):
        first = self.create("first")
        self.create("second")
        activated = self.client.put("/api/scheduler/tasks/first-leaf-0-0-0", json={"status": "in_progress"})
        self.assertEqual(activated.status_code, 200, activated.text)
        before = self.projects()
        slots = self.slots()
        disclosure = {"first-stage-0": False, "first-task-0-0": True}
        with TestClient(application()) as other:
            response = self.client.put("/api/scheduler/config", json={"focusflow": {"treeDisclosure": disclosure}})
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual(self.client.get("/api/v1/tasks/tree").json()["projectId"], first["projectId"])
            self.assertEqual(self.slots(), slots)
            self.assertEqual([p["tree"] for p in self.projects()], [p["tree"] for p in before])
            self.assertEqual(self.projects()[0]["revision"], before[0]["revision"] + 1)
            shared = other.get("/api/scheduler/config").json()["data"]
            self.assertEqual(shared["focusflow"]["treeDisclosure"], disclosure)
            self.assertEqual(other.get("/api/scheduler/timeline", params={"projectId": "all"}).json()["data"]["events"], slots)


if __name__ == "__main__":
    unittest.main()
