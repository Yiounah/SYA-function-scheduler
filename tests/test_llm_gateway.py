"""Model failures stay actionable without exposing provider data or saving sample plans."""

from __future__ import annotations

import json
import os
import unittest
from unittest.mock import patch

os.environ["SYA_SCHEDULER_MODEL_KEY"] = ""

import httpx

from app.core.config import Settings
from app.core.llm.gateway import OpenAICompatiblePlannerGateway, PlanningModelError
from app.models.persona import resolve_persona


class ModelGatewayTests(unittest.IsolatedAsyncioTestCase):
    def gateway(self, key: str = "test-model-key") -> OpenAICompatiblePlannerGateway:
        return OpenAICompatiblePlannerGateway(Settings(_env_file=None, scheduler_model_key=key, scheduler_model_base_url="https://private.invalid/v1"))

    async def generate(self, gateway: OpenAICompatiblePlannerGateway) -> dict:
        return await gateway.generate_task_tree(
            goal="Prepare a research outline", persona=resolve_persona("balanced"),
            strategy=None, context={}, response_schema={"type": "object"}, allow_mock=False,
        )

    def transport(self, handler):
        client = httpx.AsyncClient
        return patch(
            "app.core.llm.gateway.httpx.AsyncClient",
            side_effect=lambda **kwargs: client(transport=httpx.MockTransport(handler), **kwargs),
        )

    async def test_missing_key_does_not_call_provider_or_return_sample(self) -> None:
        with patch("app.core.llm.gateway.httpx.AsyncClient") as client:
            with self.assertRaises(PlanningModelError) as failure:
                await self.generate(self.gateway(""))
            self.assertEqual(failure.exception.code, "MODEL_NOT_CONFIGURED")
            client.assert_not_called()

    @staticmethod
    def response(text, status="completed"):
        return {"status": status, "output": [{"type": "message", "content": [{"type": "output_text", "text": text}]}]}

    async def test_sol_request_uses_private_responses_configuration(self) -> None:
        def reply(request):
            payload = json.loads(request.content)
            self.assertEqual(request.url.path, "/v1/responses")
            self.assertEqual(payload["model"], "gpt-6.1-sol")
            self.assertEqual(payload["input"][0]["role"], "user")
            self.assertIn("JSON", payload["input"][0]["content"])
            self.assertIn("Prepare a research outline", payload["input"][0]["content"])
            self.assertEqual(payload["text"]["format"], {"type": "json_object"})
            self.assertFalse(payload["store"])
            return httpx.Response(200, json=self.response('{"title":"Outline"}'))

        with self.transport(reply):
            self.assertEqual(await self.generate(self.gateway()), {"title": "Outline"})

    async def test_http_failures_have_safe_actionable_codes(self) -> None:
        for status, code in ((401, "MODEL_AUTH_FAILED"), (403, "MODEL_AUTH_FAILED"), (429, "MODEL_RATE_LIMITED"), (503, "MODEL_UNAVAILABLE")):
            with self.subTest(status=status):
                with self.transport(lambda _: httpx.Response(status, text="private-provider-payload")):
                    with self.assertLogs("app.core.llm.gateway", level="WARNING") as logs:
                        with self.assertRaises(PlanningModelError) as failure:
                            await self.generate(self.gateway())
                    self.assertEqual(failure.exception.code, code)
                    self.assertNotIn("private-provider-payload", str(failure.exception))
                    self.assertNotIn("private-provider-payload", "\n".join(logs.output))
                    self.assertNotIn("test-model-key", "\n".join(logs.output))

    async def test_timeout_does_not_silently_return_a_sample(self) -> None:
        def timeout(request):
            raise httpx.ReadTimeout("private-provider-context", request=request)

        with self.transport(timeout):
            with self.assertRaises(PlanningModelError) as failure:
                await self.generate(self.gateway())
        self.assertEqual(failure.exception.code, "MODEL_TIMEOUT")
        self.assertNotIn("private-provider-context", str(failure.exception))

    async def test_truncated_and_invalid_responses_are_not_accepted_as_plans(self) -> None:
        cases = [
            self.response('{"title":"partial"}', "incomplete"),
            self.response("not-json"),
            self.response(""),
            {"status": "completed", "output": []},
        ]
        for payload in cases:
            with self.subTest(payload=payload):
                with self.transport(lambda _: httpx.Response(200, json=payload)):
                    with self.assertRaises(PlanningModelError) as failure:
                        await self.generate(self.gateway())
                self.assertEqual(failure.exception.code, "MODEL_RESPONSE_INVALID")

    async def test_model_cannot_change_an_unrequested_task(self):
        with self.transport(lambda _: httpx.Response(200, json=self.response('{"other": "Replace"}'))):
            with self.assertRaises(PlanningModelError) as failure:
                await self.gateway().replan_steps("Goal", [{"id": "pending"}], {})
            self.assertEqual(failure.exception.code, "MODEL_RESPONSE_INVALID")
