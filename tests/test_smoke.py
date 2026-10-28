from __future__ import annotations

import hashlib
import hmac
import json
import os
import unittest
from pathlib import Path

os.environ["SYA_OPENAI_API_KEY"] = ""

from fastapi.testclient import TestClient

from app.config import get_settings

get_settings.cache_clear()

from app.main import app


def walk_leaves(node: dict) -> list[dict]:
    """Collect leaf nodes from a JSON task tree snapshot."""

    if not node.get("children"):
        return [node]

    leaves: list[dict] = []
    for child in node["children"]:
        leaves.extend(walk_leaves(child))
    return leaves


class FocusFlowAppTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client_ctx = TestClient(app)
        self.client = self.client_ctx.__enter__()

    def tearDown(self) -> None:
        self.client_ctx.__exit__(None, None, None)

    def _drain_events(self) -> None:
        self.client.portal.call(self.client.app.state.container.event_bus.join)

    def test_health(self) -> None:
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["data"]["functionId"], "scheduler")

    def test_app_ui_is_served(self) -> None:
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("text/html", response.headers["content-type"])
        self.assertIn("任务规划", response.text)
        self.assertNotIn("科研任务规划", response.text)
        self.assertIn("新建规划", response.text)
        self.assertIn('data-i18n="day">日<', response.text)
        self.assertIn('data-i18n="timeline">周<', response.text)
        self.assertIn('data-i18n="calendar">月<', response.text)
        self.assertIn("任务树", response.text)
        self.assertIn('data-nav="day"', response.text)
        self.assertIn("长程目标", response.text)
        self.assertIn('src="/static/app.js"', response.text)
        self.assertIn('href="/static/styles.css"', response.text)
        script = self.client.get('/static/app.js')
        style = self.client.get('/static/styles.css')
        self.assertEqual(script.status_code, 200)
        self.assertEqual(style.status_code, 200)
        self.assertIn('javascript', script.headers['content-type'])
        self.assertIn('text/css', style.headers['content-type'])
        self.assertEqual(self.client.get('/static/index.html').status_code, 404)
        self.assertIn("今日粒度", response.text)
        self.assertIn('data-lang="en"', response.text)
        self.assertIn("Research Planner", script.text)
        self.assertNotIn("Live Event Stream", response.text)
        self.assertNotIn("FocusFlow Planner", response.text)

    def test_init_creates_task_tree(self) -> None:
        response = self.client.post(
            "/api/v1/tasks/init",
            json={"goal": "Build an AI scheduling backend", "persona": "balanced"},
        )
        self.assertEqual(response.status_code, 200)

        self._drain_events()
        tree_response = self.client.get("/api/v1/tasks/tree")
        self.assertEqual(tree_response.status_code, 200)

        tree = tree_response.json()
        leaves = walk_leaves(tree)
        self.assertGreaterEqual(len(leaves), 1)
        self.assertTrue(all(leaf["status"] == "PENDING" for leaf in leaves))

    def test_status_updates_and_replan_flow(self) -> None:
        self.client.post(
            "/api/v1/tasks/init",
            json={"goal": "Build an AI scheduling backend", "persona": "balanced"},
        )
        self._drain_events()

        initial_tree = self.client.get("/api/v1/tasks/tree").json()
        initial_leaves = walk_leaves(initial_tree)

        for index, leaf in enumerate(initial_leaves[:3], start=1):
            response = self.client.patch(
                f"/api/v1/tasks/{leaf['task_id']}/status",
                json={"status": "DONE", "actual_time": 1.0 + index},
            )
            self.assertEqual(response.status_code, 200)

        self._drain_events()
        final_tree = self.client.get("/api/v1/tasks/tree").json()
        final_leaves = walk_leaves(final_tree)
        final_statuses = {leaf["task_id"]: leaf["status"] for leaf in final_leaves}

        self.assertEqual(final_statuses[initial_leaves[0]["task_id"]], "DONE")
        self.assertEqual(final_statuses[initial_leaves[1]["task_id"]], "DONE")
        self.assertEqual(final_statuses[initial_leaves[2]["task_id"]], "DONE")
        self.assertTrue(any(task_id.endswith("-c1") for task_id in final_statuses))
        self.assertTrue(any(task_id.endswith("-c2") for task_id in final_statuses))

    def test_websocket_receives_initial_events(self) -> None:
        with self.client.websocket_connect("/ws/tree?scope=all") as websocket:
            response = self.client.post(
                "/api/v1/tasks/init",
                json={"goal": "Plan a release", "persona": "balanced"},
            )
            self.assertEqual(response.status_code, 200)

            self._drain_events()
            first_message = websocket.receive_json()
            second_message = websocket.receive_json()

        event_types = {first_message["event_type"], second_message["event_type"]}
        self.assertEqual(event_types, {"NEW_TASK", "TREE_MUTATED"})

    def test_sya_decompose_matches_dashboard_shape(self) -> None:
        empty = self.client.get("/api/scheduler/timeline")
        self.assertEqual(empty.status_code, 200)
        empty_payload = empty.json()
        self.assertTrue(empty_payload["ok"])
        self.assertEqual(empty_payload["data"]["events"], [])

        response = self.client.post(
            "/api/scheduler/decompose",
            json={"input": "Prepare the weekly research update", "attachments": []},
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["ok"])
        data = payload["data"]
        self.assertIn("tasks", data)
        self.assertIn("events", data["timeline"])
        self.assertGreaterEqual(len(data["tasks"]), 1)
        self.assertGreaterEqual(len(data["timeline"]["events"]), 1)

        event = data["timeline"]["events"][0]
        self.assertIn("time", event)
        self.assertIn("taskId", event)
        self.assertIn("title", event)
        self.assertIn(event["status"], {"active", "upcoming", "completed"})

        task = data["tasks"][0]
        self.assertIn("id", task)
        self.assertIn(task["status"], {"pending", "active", "completed"})
        self.assertIsInstance(task["subtasks"], list)
        self.assertTrue(task["createdAt"])

        listed = self.client.get("/api/scheduler/tasks").json()["data"]
        self.assertGreaterEqual(len(listed), 1)
        fetched = self.client.get(f"/api/scheduler/tasks/{task['id']}").json()["data"]
        self.assertEqual(fetched["id"], task["id"])

        stats = self.client.get("/api/scheduler/stats").json()["data"]
        self.assertIn("completedCount", stats)
        config = self.client.get("/api/scheduler/config").json()["data"]
        self.assertIn("defaultDurationMinutes", config)
        self.assertIn("autoScheduleEnabled", config)

        manifest = self.client.get("/manifest")
        self.assertEqual(manifest.status_code, 200)
        self.assertEqual(manifest.json()["id"], "scheduler")

    def test_planner_routes_are_in_the_host_contract(self) -> None:
        contract = json.loads(
            (Path(__file__).resolve().parents[1] / "api.openapi.json").read_text()
        )
        operation_ids = {
            operation["operationId"]
            for path in contract["paths"].values()
            for operation in path.values()
            if isinstance(operation, dict) and "operationId" in operation
        }
        self.assertTrue(
            {
                "projects.list",
                "tasks.init",
                "tasks.revise",
                "tasks.status",
                "tasks.translate",
                "tasks.tree",
                "voyage.get",
                "plans.preview",
                "plans.confirm",
                "plans.commit",
                "granularity.preview",
                "routine.preview",
            }.issubset(operation_ids)
        )
        self.assertIn("/api/v1/projects", contract["paths"])
        self.assertIn("/api/scheduler/decompose", contract["paths"])

    def test_host_token_gates_planner_routes(self) -> None:
        os.environ["FUNCTION_RUNTIME_TOKEN"] = "secret-token"
        os.environ["FUNCTION_RUNTIME_PROOF_KEY"] = "proof-key"
        try:
            denied = self.client.get("/api/v1/projects")
            self.assertEqual(denied.status_code, 401)
            self.assertEqual(self.client.get('/static/app.js').status_code, 401)
            self.assertEqual(self.client.get('/static/styles.css', headers={'Authorization': 'Bearer secret-token'}).status_code, 200)
            wrong = self.client.get(
                "/health",
                headers={"Authorization": "Bearer wrong-token"},
            )
            self.assertEqual(wrong.status_code, 401)

            health = self.client.get(
                "/health",
                headers={"Authorization": "Bearer secret-token"},
            )
            self.assertEqual(health.status_code, 200)
            expected = hmac.new(b"proof-key", b"sya-runtime-v1", hashlib.sha256).hexdigest()
            self.assertEqual(health.headers["x-sya-runtime-proof"], expected)

            listed = self.client.get(
                "/api/v1/projects",
                headers={"Authorization": "Bearer secret-token"},
            )
            self.assertEqual(listed.status_code, 200)
        finally:
            os.environ.pop("FUNCTION_RUNTIME_TOKEN", None)
            os.environ.pop("FUNCTION_RUNTIME_PROOF_KEY", None)


if __name__ == "__main__":
    unittest.main()
