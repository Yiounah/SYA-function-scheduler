"""OpenAI-compatible planner gateway with a deterministic offline mock."""

from __future__ import annotations

import json
import logging
from abc import ABC, abstractmethod
from typing import Any
from uuid import uuid4

import httpx

from app.core.config import Settings
from app.models.domain_events import ReplanStrategy
from app.models.persona import PersonaProfile

logger = logging.getLogger(__name__)


class PlanningModelError(RuntimeError):
    """Safe model failure details for the planner API, without provider payloads."""

    MESSAGES = {
        "MODEL_NOT_CONFIGURED": "Configure the planning model API key before generating a plan.",
        "MODEL_AUTH_FAILED": "The planning model rejected the API credentials or access permissions.",
        "MODEL_RATE_LIMITED": "The planning model is rate limited. Retry later or check the account quota.",
        "MODEL_TIMEOUT": "The planning model timed out. Retry the preview.",
        "MODEL_RESPONSE_INVALID": "The planning model returned an incomplete or invalid plan. Retry the preview.",
        "MODEL_UNAVAILABLE": "The planning model is unavailable. Retry or explicitly choose the sample plan.",
    }

    def __init__(self, code: str) -> None:
        self.code = code
        super().__init__(self.MESSAGES[code])


class LLMPlannerGateway(ABC):
    """Abstract LLM adapter for OpenAI-compatible task decomposition."""

    @abstractmethod
    async def generate_task_tree(
        self,
        *,
        goal: str,
        persona: PersonaProfile,
        strategy: ReplanStrategy | None,
        context: dict[str, Any],
        response_schema: dict[str, Any],
        allow_mock: bool = True,
    ) -> dict[str, Any]:
        """Return JSON matching the provided schema for planning operations."""


class OpenAICompatiblePlannerGateway(LLMPlannerGateway):
    """OpenAI-format client with deterministic fallback for offline development."""

    def __init__(self, settings: Settings) -> None:
        self._base_url = settings.scheduler_model_base_url.rstrip("/")
        self._api_key = settings.scheduler_model_key
        self._model = settings.scheduler_model_name
        self._timeout_seconds = settings.llm_timeout_seconds

    async def generate_task_tree(
        self,
        *,
        goal: str,
        persona: PersonaProfile,
        strategy: ReplanStrategy | None,
        context: dict[str, Any],
        response_schema: dict[str, Any],
        allow_mock: bool = True,
    ) -> dict[str, Any]:
        """Generate decomposition tree via OpenAI API format or local fallback."""

        if not self.configured:
            if not allow_mock:
                raise PlanningModelError("MODEL_NOT_CONFIGURED")
            logger.warning("LLM is not configured; using local mock plan")
            return self._mock_plan(goal=goal, persona=persona, strategy=strategy, context=context)

        system_prompt = (
            "You are a cognitive-aware planning model. Output a single JSON object only. "
            "No markdown, no explanations, and obey this JSON Schema exactly:\n"
            f"{json.dumps(response_schema, ensure_ascii=False)}"
        )
        user_prompt = self._compose_prompt(goal, persona, strategy, context)

        try:
            return await self._request_json(system_prompt, user_prompt)
        except PlanningModelError:
            if not allow_mock:
                raise
            logger.warning("Using the legacy local mock plan")
            return self._mock_plan(goal=goal, persona=persona, strategy=strategy, context=context)

    @property
    def configured(self) -> bool:
        return bool(self._api_key and self._base_url)

    async def _request_json(self, instructions: str, prompt: str) -> dict[str, Any]:
        if not self.configured:
            raise PlanningModelError("MODEL_NOT_CONFIGURED")
        payload = {
            "model": self._model, "instructions": instructions,
            "input": [{"role": "user", "content": f"Return one JSON object.\n{prompt}"}],
            "text": {"format": {"type": "json_object"}}, "store": False,
        }
        # HTTPX normally logs the full request URL. This process is the private
        # Scheduler sidecar; provider addresses must never enter desktop logs.
        for name in ("httpx", "httpcore"):
            logging.getLogger(name).setLevel(logging.WARNING)
        try:
            async with httpx.AsyncClient(timeout=self._timeout_seconds, trust_env=False) as client:
                response = await client.post(
                    f"{self._base_url}/responses",
                    headers={"Authorization": f"Bearer {self._api_key}"},
                    json=payload,
                )
                response.raise_for_status()
                result = response.json()
            if result.get("status") != "completed":
                raise ValueError("Incomplete response")
            content = "".join(
                part["text"] for item in result["output"] if item.get("type") == "message"
                for part in item["content"] if part.get("type") == "output_text"
            )
            return self._load_json_content(content)
        except Exception as exc:
            code = "MODEL_UNAVAILABLE"
            status = None
            if isinstance(exc, httpx.HTTPStatusError):
                status = exc.response.status_code
                if status in (401, 403):
                    code = "MODEL_AUTH_FAILED"
                elif status == 429:
                    code = "MODEL_RATE_LIMITED"
            elif isinstance(exc, httpx.TimeoutException):
                code = "MODEL_TIMEOUT"
            elif isinstance(exc, (ValueError, KeyError, IndexError, TypeError, AttributeError)):
                code = "MODEL_RESPONSE_INVALID"
            # Provider response bodies can contain private input; expose fixed diagnostics only.
            logger.warning("Planning model request failed: code=%s http_status=%s", code, status)
            raise PlanningModelError(code) from None

    async def replan_steps(self, goal: str, steps: list[dict], context: dict) -> dict[str, str]:
        """Give bounded pending work units concrete actions without delegating tree edits."""
        instructions = (
            "You revise the pending steps of a project. For each work unit write a concise "
            "action with a concrete deliverable that fits its fixed minutes. Split broad work "
            "into successive distinct actions or combine related work as indicated. Preserve "
            "the original intent, language and requirements. Return a JSON object mapping "
            "each supplied id to its new title. Return exactly those ids."
        )
        result = await self._request_json(instructions, json.dumps(
            {"goal": goal, "work_units": steps, "adjustment": context}, ensure_ascii=False))
        if set(result) != {step["id"] for step in steps} or any(
            not isinstance(title, str) or not title.strip() or len(title) > 500 for title in result.values()
        ):
            raise PlanningModelError("MODEL_RESPONSE_INVALID")
        return {key: title.strip() for key, title in result.items()}

    def _compose_prompt(
        self,
        goal: str,
        persona: PersonaProfile,
        strategy: ReplanStrategy | None,
        context: dict[str, Any],
    ) -> str:
        """Build prompt text with intent and efficacy-aware planning context."""

        strategy_text = strategy.value if strategy else "INITIAL"
        return (
            f"Goal: {goal}\n"
            f"Persona: {persona.model_dump(mode='json')}\n"
            f"Strategy: {strategy_text}\n"
            f"Context: {json.dumps(context, ensure_ascii=True)}\n"
            "Treat this as a long-horizon goal. Parents are multi-day or multi-week "
            "milestones; leaves are the next executable steps. Keep estimated_time in hours "
            "and produce an explicit hierarchy at least two levels deep: "
            "课题 → 阶段 → 子任务 → 清单. "
            "Write every title and description in English, even when the goal is not English."
        )

    async def translate_nodes(self, *, target: str, nodes: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Translate task titles and descriptions. The stored plan itself stays unchanged."""

        if not nodes or not self.configured:
            return nodes

        language = "Simplified Chinese" if target == "zh" else "English"
        system_prompt = (
            "You translate planning tasks. Output a single JSON object only. "
            "No markdown. Keep every task_id unchanged and do not add or remove nodes."
        )
        user_prompt = (
            f"Translate each title and description into {language}. "
            "If a field is already in that language, keep its wording. "
            'Return {"nodes": [{"task_id", "title", "description"}]}.\n'
            f"{json.dumps({'nodes': nodes}, ensure_ascii=False)}"
        )
        try:
            parsed = await self._request_json(system_prompt, user_prompt)
            if not isinstance(parsed.get("nodes"), list):
                raise PlanningModelError("MODEL_RESPONSE_INVALID")
        except PlanningModelError:
            logger.warning("Task translation failed; source wording will be kept")
            return nodes

        translated = {
            str(item.get("task_id")): item
            for item in parsed.get("nodes", [])
            if isinstance(item, dict) and item.get("task_id")
        }
        merged: list[dict[str, Any]] = []
        for node in nodes:
            hit = translated.get(str(node.get("task_id")))
            title = str(hit.get("title")).strip() if hit and hit.get("title") else ""
            if not title:
                merged.append(node)
                continue
            merged.append(
                {
                    "task_id": node["task_id"],
                    "title": title,
                    "description": str(hit.get("description") or ""),
                }
            )
        return merged

    def _load_json_content(self, content: str) -> dict[str, Any]:
        """Parse JSON body and recover from fenced blocks when necessary."""

        cleaned = content.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`")
            cleaned = cleaned.replace("json", "", 1).strip()
        payload = json.loads(cleaned)
        if not isinstance(payload, dict):
            raise ValueError("Expected object JSON payload")
        return payload

    def _mock_plan(
        self,
        *,
        goal: str,
        persona: PersonaProfile,
        strategy: ReplanStrategy | None,
        context: dict[str, Any],
    ) -> dict[str, Any]:
        """Generate deterministic local plans when remote LLM is unavailable."""

        if strategy is None:
            root_id = f"root-{uuid4().hex[:8]}"
            return {
                "task_id": root_id,
                "title": goal,
                "description": f"Top-level plan for persona {persona.persona_id}",
                "estimated_time": 8.0,
                "is_leaf": False,
                "children": [
                    {
                        "task_id": f"{root_id}-a",
                        "title": "Clarify success criteria",
                        "description": "Define measurable completion outcomes.",
                        "estimated_time": 1.0,
                        "is_leaf": True,
                        "children": [],
                    },
                    {
                        "task_id": f"{root_id}-b",
                        "title": "Build execution roadmap",
                        "description": "Segment milestones and dependencies.",
                        "estimated_time": 2.0,
                        "is_leaf": False,
                        "children": [
                            {
                                "task_id": f"{root_id}-b1",
                                "title": "Schedule milestone sprint",
                                "description": "Create near-term wave with concrete outputs.",
                                "estimated_time": 1.5,
                                "is_leaf": True,
                                "children": [],
                            },
                            {
                                "task_id": f"{root_id}-b2",
                                "title": "Define risk mitigation checks",
                                "description": "Prepare contingencies for blockers.",
                                "estimated_time": 1.0,
                                "is_leaf": True,
                                "children": [],
                            },
                        ],
                    },
                    {
                        "task_id": f"{root_id}-c",
                        "title": "Execute and monitor",
                        "description": "Track outcomes and capture metrics.",
                        "estimated_time": 3.0,
                        "is_leaf": True,
                        "children": [],
                    },
                ],
            }

        target_id = str(context.get("target_node_id", f"target-{uuid4().hex[:6]}"))
        if strategy == ReplanStrategy.FINE:
            return {
                "target_node_id": target_id,
                "children": [
                    {
                        "task_id": f"{target_id}-m1",
                        "title": "Prepare micro-task checklist",
                        "description": "Break pending work into 15-30 minute chunks.",
                        "estimated_time": 0.5,
                        "is_leaf": True,
                        "children": [],
                    },
                    {
                        "task_id": f"{target_id}-m2",
                        "title": "Add explicit time boxing",
                        "description": "Assign strict short deadlines for each chunk.",
                        "estimated_time": 0.5,
                        "is_leaf": True,
                        "children": [],
                    },
                    {
                        "task_id": f"{target_id}-m3",
                        "title": "Define immediate validation points",
                        "description": "Create quick completion checks after each chunk.",
                        "estimated_time": 0.5,
                        "is_leaf": True,
                        "children": [],
                    },
                ],
            }

        return {
            "target_node_id": target_id,
            "children": [
                {
                    "task_id": f"{target_id}-c1",
                    "title": "Merge routine activities",
                    "description": "Group repetitive pending steps into one macro action.",
                    "estimated_time": 2.0,
                    "is_leaf": True,
                    "children": [],
                },
                {
                    "task_id": f"{target_id}-c2",
                    "title": "Focus on milestone output",
                    "description": "Prioritize high-impact deliverables over micro tracking.",
                    "estimated_time": 2.5,
                    "is_leaf": True,
                    "children": [],
                },
            ],
        }
