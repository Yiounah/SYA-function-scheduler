"""Navigator: decompose a 课题 and incrementally edit the pending frontier."""

from __future__ import annotations

from typing import Any

from app.core.event_bus import AsyncEventBus
from app.core.llm.gateway import LLMPlannerGateway
from app.core.memory_store import MemoryStore
from app.models.domain_events import (
    DomainEvent,
    EventType,
    NewTaskRequestPayload,
    ReplanDecisionPayload,
    ReplanStrategy,
    ReplanTriggerPayload,
    TaskTreeDraftPayload,
)
from app.models.persona import PersonaProfile, resolve_persona
from app.models.voyage import VoyagePhase


class Navigator:
    """Planning brain. Initial tree plus rolling-wave subtree replacement."""

    def __init__(
        self,
        *,
        event_bus: AsyncEventBus,
        memory_store: MemoryStore,
        llm_gateway: LLMPlannerGateway,
    ) -> None:
        self._event_bus = event_bus
        self._memory_store = memory_store
        self._llm_gateway = llm_gateway
        self._registered = False

    def register(self) -> None:
        """Attach planning handlers to the asynchronous event bus."""
        if self._registered:
            return

        self._event_bus.subscribe(EventType.NEW_TASK_REQUEST, self._on_new_task_request)
        self._event_bus.subscribe(EventType.REPLAN_FINE_GRAINED, self._on_replan_request)
        self._event_bus.subscribe(EventType.REPLAN_COARSE_GRAINED, self._on_replan_request)
        self._registered = True

    async def _on_new_task_request(self, event: DomainEvent) -> None:
        """Capture intent and draft the first 课题 → 阶段 tree."""

        payload = NewTaskRequestPayload.model_validate(event.payload)
        persona = resolve_persona(payload.persona)

        await self._memory_store.start_voyage(goal=payload.goal, persona=persona.persona_id)
        await self._memory_store.set_voyage_phase(VoyagePhase.PLANNING)

        context = self._assemble_intent_context(goal=payload.goal, persona=persona)
        tree_json = await self._llm_gateway.generate_task_tree(
            goal=payload.goal,
            persona=persona,
            strategy=None,
            context=context,
            response_schema=self._initial_tree_schema(),
        )

        draft_payload = TaskTreeDraftPayload(
            goal=payload.goal,
            persona=persona.persona_id,
            tree_json=tree_json,
        )
        await self._event_bus.publish(
            DomainEvent.build(
                event_type=EventType.TASK_TREE_DRAFTED,
                source="navigator",
                payload_model=draft_payload,
                correlation_id=event.event_id,
            )
        )

    async def _on_replan_request(self, event: DomainEvent) -> None:
        """Edit the pending frontier in place; do not rebuild the whole tree."""

        decision = ReplanDecisionPayload.model_validate(event.payload)
        strategy = (
            ReplanStrategy.FINE
            if event.event_type == EventType.REPLAN_FINE_GRAINED
            else ReplanStrategy.COARSE
        )

        await self._memory_store.set_voyage_phase(VoyagePhase.PLANNING)

        goal, persona_name = await self._memory_store.get_goal_context()
        if not goal:
            return

        persona = resolve_persona(persona_name or "balanced")
        target_subtree = await self._memory_store.get_subtree_snapshot(decision.target_node_id)
        if target_subtree is None:
            return

        replan_context = self._assemble_replan_context(
            goal=goal,
            persona=persona,
            strategy=strategy,
            target_node_id=decision.target_node_id,
            target_subtree=target_subtree,
            completion_rate=decision.completion_rate,
            procrastination_index=decision.procrastination_index,
        )

        subtree_json = await self._llm_gateway.generate_task_tree(
            goal=goal,
            persona=persona,
            strategy=strategy,
            context=replan_context,
            response_schema=self._replan_schema(),
        )

        trigger_payload = ReplanTriggerPayload(
            target_node_id=decision.target_node_id,
            strategy=strategy,
            subtree_json=subtree_json,
        )
        await self._event_bus.publish(
            DomainEvent.build(
                event_type=EventType.REPLAN_TRIGGER,
                source="navigator",
                payload_model=trigger_payload,
                correlation_id=event.event_id,
            )
        )

    def _assemble_intent_context(
        self,
        *,
        goal: str,
        persona: PersonaProfile,
    ) -> dict[str, Any]:
        """Create planning context for initial intent-to-plan translation."""

        return {
            "cognitive_phase": "intent_capture",
            "goal": goal,
            "persona": persona.model_dump(mode="json"),
            "horizon": "long",
            "constraints": {
                "must_return_json": True,
                "leaf_nodes_default_pending": True,
                "hierarchy_depth_min": 2,
                "prefer_milestone_parents": True,
                "shape": "课题 → 阶段 → 子任务 → 清单",
            },
        }

    def _assemble_replan_context(
        self,
        *,
        goal: str,
        persona: PersonaProfile,
        strategy: ReplanStrategy,
        target_node_id: str,
        target_subtree: dict[str, Any],
        completion_rate: float,
        procrastination_index: float,
    ) -> dict[str, Any]:
        """Create efficacy-aware context for dynamic granularity adaptation."""

        return {
            "cognitive_phase": "dynamic_replanning",
            "goal": goal,
            "persona": persona.model_dump(mode="json"),
            "target_node_id": target_node_id,
            "strategy": strategy.value,
            "metrics": {
                "completion_rate": completion_rate,
                "procrastination_index": procrastination_index,
            },
            "target_subtree": target_subtree,
            "instruction": (
                "Return replacement children for pending work only. "
                "Keep completed and blocked nodes. "
                "Keep task titles executable and estimated_time realistic."
            ),
        }

    def _initial_tree_schema(self) -> dict[str, Any]:
        """Schema for full initial decomposition tree output."""

        return {
            "type": "object",
            "required": ["task_id", "title", "estimated_time", "is_leaf", "children"],
            "additionalProperties": False,
            "properties": {
                "task_id": {"type": "string"},
                "title": {"type": "string"},
                "description": {"type": "string"},
                "estimated_time": {"type": "number", "exclusiveMinimum": 0},
                "is_leaf": {"type": "boolean"},
                "children": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["task_id", "title", "estimated_time", "is_leaf", "children"],
                        "additionalProperties": True,
                        "properties": {
                            "task_id": {"type": "string"},
                            "title": {"type": "string"},
                            "description": {"type": "string"},
                            "estimated_time": {"type": "number", "exclusiveMinimum": 0},
                            "is_leaf": {"type": "boolean"},
                            "children": {"type": "array"},
                        },
                    },
                },
            },
        }

    def _replan_schema(self) -> dict[str, Any]:
        """Schema for pending-subtree replacement outputs."""

        return {
            "type": "object",
            "required": ["target_node_id", "children"],
            "additionalProperties": False,
            "properties": {
                "target_node_id": {"type": "string"},
                "children": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["task_id", "title", "estimated_time", "is_leaf", "children"],
                        "additionalProperties": True,
                        "properties": {
                            "task_id": {"type": "string"},
                            "title": {"type": "string"},
                            "description": {"type": "string"},
                            "estimated_time": {"type": "number", "exclusiveMinimum": 0},
                            "is_leaf": {"type": "boolean"},
                            "children": {"type": "array"},
                        },
                    },
                },
            },
        }
