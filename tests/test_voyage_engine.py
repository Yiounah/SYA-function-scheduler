from __future__ import annotations

import os
import unittest

os.environ["SYA_OPENAI_API_KEY"] = ""

from fastapi.testclient import TestClient

from app.config import get_settings

get_settings.cache_clear()

from app.main import app
from app.models.voyage import VoyagePhase


def walk_leaves(node: dict) -> list[dict]:
    if not node.get("children"):
        return [node]
    leaves: list[dict] = []
    for child in node["children"]:
        leaves.extend(walk_leaves(child))
    return leaves


class VoyageRuntimeTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client_ctx = TestClient(app)
        self.client = self.client_ctx.__enter__()

    def tearDown(self) -> None:
        self.client_ctx.__exit__(None, None, None)

    def _drain_events(self) -> None:
        self.client.portal.call(self.client.app.state.container.event_bus.join)

    def test_init_opens_executing_voyage(self) -> None:
        response = self.client.post(
            "/api/v1/tasks/init",
            json={"goal": "Write a survey paper", "persona": "balanced"},
        )
        self.assertEqual(response.status_code, 200)
        self._drain_events()

        voyage = self.client.get("/api/v1/voyage")
        self.assertEqual(voyage.status_code, 200)
        payload = voyage.json()
        self.assertEqual(payload["goal"], "Write a survey paper")
        self.assertEqual(payload["phase"], VoyagePhase.EXECUTING.value)

    def test_blocked_leaf_is_split_into_micro_tasks(self) -> None:
        self.client.post(
            "/api/v1/tasks/init",
            json={"goal": "Write a survey paper", "persona": "balanced"},
        )
        self._drain_events()

        tree = self.client.get("/api/v1/tasks/tree").json()
        first_leaf = walk_leaves(tree)[0]
        response = self.client.patch(
            f"/api/v1/tasks/{first_leaf['task_id']}/status",
            json={"status": "BLOCKED"},
        )
        self.assertEqual(response.status_code, 200)
        self._drain_events()

        final_tree = self.client.get("/api/v1/tasks/tree").json()
        final_ids = {leaf["task_id"] for leaf in walk_leaves(final_tree)}
        self.assertTrue(any(task_id.endswith("-m1") for task_id in final_ids))
        self.assertTrue(any(task_id.endswith("-m2") for task_id in final_ids))
        self.assertNotIn(first_leaf["task_id"], final_ids)


if __name__ == "__main__":
    unittest.main()
