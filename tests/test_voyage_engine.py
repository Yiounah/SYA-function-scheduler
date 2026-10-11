from __future__ import annotations

import os
import unittest

os.environ["SYA_OPENAI_API_KEY"] = ""

from fastapi.testclient import TestClient

from app.config import get_settings

get_settings.cache_clear()

from app.core.llm.gateway import OpenAICompatiblePlannerGateway
from app.main import app
from app.models.persona import resolve_persona
from app.models.task_tree import TaskNode, TaskStatus
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
        self.assertIsNone(payload["deadline_days"])

    def test_init_stores_deadline_days(self) -> None:
        response = self.client.post(
            "/api/v1/tasks/init",
            json={"goal": "Write a survey paper", "persona": "balanced", "deadline_days": 14},
        )
        self.assertEqual(response.status_code, 200)
        self._drain_events()

        voyage = self.client.get("/api/v1/voyage")
        self.assertEqual(voyage.status_code, 200)
        self.assertEqual(voyage.json()["deadline_days"], 14)

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

    def test_revise_keeps_completed_work_on_the_same_project(self) -> None:
        self.client.post(
            "/api/v1/tasks/init",
            json={"goal": "Write a survey paper", "persona": "balanced", "deadline_days": 21},
        )
        self._drain_events()

        tree = self.client.get("/api/v1/tasks/tree").json()
        done_leaf = walk_leaves(tree)[0]
        self.client.patch(
            f"/api/v1/tasks/{done_leaf['task_id']}/status",
            json={"status": "DONE"},
        )
        self._drain_events()

        response = self.client.post(
            f"/api/v1/tasks/{tree['task_id']}/revise",
            json={"goal": "Write a shorter survey", "persona": "micro", "deadline_days": 10},
        )
        self.assertEqual(response.status_code, 200)

        final_tree = self.client.get("/api/v1/tasks/tree").json()
        self.assertEqual(final_tree["task_id"], tree["task_id"])
        self.assertEqual(final_tree["title"], "Write a shorter survey")
        kept = next(leaf for leaf in walk_leaves(final_tree) if leaf["task_id"] == done_leaf["task_id"])
        self.assertEqual(kept["status"], "DONE")
        self.assertEqual(kept["title"], done_leaf["title"])
        voyage = self.client.get("/api/v1/voyage").json()
        self.assertEqual(voyage["deadline_days"], 10)
        self.assertEqual(voyage["persona"], "micro")

    def test_pending_parent_keeps_a_finished_child(self) -> None:
        done = TaskNode(task_id="done", title="Finished checklist", status=TaskStatus.DONE)
        pending = TaskNode(task_id="todo", title="Still open", status=TaskStatus.PENDING)
        stage = TaskNode(task_id="stage", title="Stage", status=TaskStatus.PENDING, children=[done, pending])
        other = TaskNode(task_id="other", title="Other project", status=TaskStatus.PENDING)
        root = TaskNode(task_id="root", title="Project", children=[stage, other])
        fresh = TaskNode(task_id="fresh", title="New pending work", status=TaskStatus.PENDING)

        stats = root.replace_pending_children([fresh])

        self.assertEqual(stats["preserved_children"], 1)
        self.assertEqual(root.children[0].task_id, "stage")
        kept = root.children[0].children
        self.assertEqual([node.task_id for node in kept], ["done"])
        self.assertEqual(kept[0].status, TaskStatus.DONE)
        self.assertEqual(kept[0].title, "Finished checklist")
        self.assertEqual(root.children[1].task_id, "fresh")
        self.assertTrue(all(node.task_id != "other" for node in root.iter_nodes()))

    def test_translate_without_api_key_keeps_source_wording(self) -> None:
        response = self.client.post(
            "/api/v1/tasks/translate",
            json={
                "target": "en",
                "nodes": [{"task_id": "a", "title": "备考雅思", "description": "听力"}],
            },
        )
        self.assertEqual(response.status_code, 200)
        node = response.json()["nodes"][0]
        self.assertEqual(node["task_id"], "a")
        self.assertEqual(node["title"], "备考雅思")
        self.assertEqual(node["description"], "听力")

    def test_plan_prompt_asks_for_english_tasks(self) -> None:
        gateway = OpenAICompatiblePlannerGateway(get_settings())
        prompt = gateway._compose_prompt("备考雅思", resolve_persona("balanced"), None, {})
        self.assertIn("English", prompt)

    def test_second_plan_keeps_the_first_project(self) -> None:
        self.client.post(
            "/api/v1/tasks/init",
            json={"goal": "First paper", "persona": "balanced", "deadline_days": 14},
        )
        self._drain_events()
        first = self.client.get("/api/v1/tasks/tree").json()

        self.client.post(
            "/api/v1/tasks/init",
            json={"goal": "Second paper", "persona": "macro", "deadline_days": 28},
        )
        self._drain_events()

        listing = self.client.get("/api/v1/projects").json()["projects"]
        self.assertEqual([item["tree"]["title"] for item in listing], ["First paper", "Second paper"])
        self.assertEqual(listing[0]["tree"]["task_id"], first["task_id"])
        self.assertEqual(listing[0]["deadline_days"], 14)
        self.assertEqual(listing[1]["deadline_days"], 28)
        self.assertEqual(listing[1]["persona"], "macro")
        latest = self.client.get("/api/v1/tasks/tree").json()
        self.assertEqual(latest["title"], "Second paper")
        self.assertNotEqual(latest["task_id"], first["task_id"])

    def test_revise_one_project_leaves_the_other(self) -> None:
        self.client.post(
            "/api/v1/tasks/init",
            json={"goal": "First paper", "persona": "balanced", "deadline_days": 14},
        )
        self._drain_events()
        first = self.client.get("/api/v1/tasks/tree").json()
        done_leaf = walk_leaves(first)[0]
        self.client.patch(
            f"/api/v1/tasks/{done_leaf['task_id']}/status",
            json={"status": "DONE"},
        )
        self._drain_events()
        self.client.post(
            "/api/v1/tasks/init",
            json={"goal": "Second paper", "persona": "balanced", "deadline_days": 21},
        )
        self._drain_events()

        response = self.client.post(
            f"/api/v1/tasks/{first['task_id']}/revise",
            json={"goal": "Shorter first paper", "persona": "micro", "deadline_days": 10},
        )
        self.assertEqual(response.status_code, 200)

        listing = self.client.get("/api/v1/projects").json()["projects"]
        self.assertEqual([item["tree"]["title"] for item in listing], ["Shorter first paper", "Second paper"])
        kept = next(leaf for leaf in walk_leaves(listing[0]["tree"]) if leaf["task_id"] == done_leaf["task_id"])
        self.assertEqual(kept["status"], "DONE")
        self.assertEqual(listing[0]["deadline_days"], 10)
        self.assertEqual(listing[1]["deadline_days"], 21)
        self.assertEqual(listing[1]["tree"]["title"], "Second paper")

    def test_revise_unknown_project_is_not_found(self) -> None:
        response = self.client.post(
            "/api/v1/tasks/missing/revise",
            json={"goal": "Write a survey paper", "persona": "balanced", "deadline_days": 7},
        )
        self.assertEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
