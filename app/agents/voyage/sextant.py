"""Sextant: verify human progress and ask Navigator to refine granularity."""

from __future__ import annotations

from app.agents.voyage.checks import decide_replan_strategy, evaluate_progress
from app.core.config import Settings
from app.core.event_bus import AsyncEventBus
from app.core.memory_store import MemoryStore
from app.models.domain_events import (
    DomainEvent,
    EvaluateProgressPayload,
    EventType,
    ReplanDecisionPayload,
    ReplanStrategy,
    TaskStatusUpdatedPayload,
)
from app.models.task_tree import TaskStatus
from app.models.voyage import VoyagePhase


class Sextant:
    """Self-verification. Blocked/attention signals tighten the next wave."""

    def __init__(
        self,
        *,
        event_bus: AsyncEventBus,
        memory_store: MemoryStore,
        settings: Settings,
    ) -> None:
        self._event_bus = event_bus
        self._memory_store = memory_store
        self._settings = settings
        self._completed_leaf_since_eval = 0
        self._registered = False

    def register(self) -> None:
        """Attach verification handlers to the event bus."""
        if self._registered:
            return

        self._event_bus.subscribe(EventType.TASK_STATUS_UPDATED, self._on_task_status_updated)
        self._event_bus.subscribe(EventType.EVALUATE_PROGRESS, self._on_evaluate_progress)
        self._registered = True

    async def _on_task_status_updated(self, event: DomainEvent) -> None:
        """Use blocked leaves immediately; batch completed leaves for metrics."""

        payload = TaskStatusUpdatedPayload.model_validate(event.payload)
        voyage = await self._memory_store.get_voyage()
        if voyage and voyage.generation_mode != "unknown":
            # Confirmed planner journeys offer a preview through the UI. A
            # blocked/completed observation must not silently apply a rewrite.
            return

        if payload.is_leaf and payload.new_status == TaskStatus.BLOCKED:
            await self._request_replan(
                event,
                strategy=ReplanStrategy.FINE,
                target_node_id=payload.task_id,
                completion_rate=0.0,
                procrastination_index=0.0,
            )
            return

        if not payload.transitioned_to_terminal_leaf:
            return

        self._completed_leaf_since_eval += 1
        if self._completed_leaf_since_eval < self._settings.evaluation_leaf_batch_size:
            return

        self._completed_leaf_since_eval = 0
        eval_payload = EvaluateProgressPayload(window_size=self._settings.metrics_window_size)
        await self._event_bus.publish(
            DomainEvent.build(
                event_type=EventType.EVALUATE_PROGRESS,
                source="sextant",
                payload_model=eval_payload,
                correlation_id=event.event_id,
            )
        )

    async def _on_evaluate_progress(self, event: DomainEvent) -> None:
        """Evaluate efficacy metrics and choose fine/coarse replanning."""

        await self._memory_store.set_voyage_phase(VoyagePhase.VERIFYING)

        payload = EvaluateProgressPayload.model_validate(event.payload)
        samples = await self._memory_store.get_recent_execution_samples(payload.window_size)
        metrics = evaluate_progress(samples)

        strategy = decide_replan_strategy(
            metrics=metrics,
            low_threshold=self._settings.completion_low_threshold,
            high_threshold=self._settings.completion_high_threshold,
        )
        if strategy == "none":
            await self._memory_store.set_voyage_phase(VoyagePhase.EXECUTING)
            return

        replan_strategy = ReplanStrategy.FINE if strategy == "fine" else ReplanStrategy.COARSE
        target_node_id = await self._memory_store.select_replan_target(replan_strategy)
        if not target_node_id:
            await self._memory_store.set_voyage_phase(VoyagePhase.EXECUTING)
            return

        await self._request_replan(
            event,
            strategy=replan_strategy,
            target_node_id=target_node_id,
            completion_rate=metrics.completion_rate,
            procrastination_index=metrics.procrastination_index,
        )

    async def _request_replan(
        self,
        event: DomainEvent,
        *,
        strategy: ReplanStrategy,
        target_node_id: str,
        completion_rate: float,
        procrastination_index: float,
    ) -> None:
        """Hand a verification verdict back to Navigator."""

        decision_payload = ReplanDecisionPayload(
            target_node_id=target_node_id,
            completion_rate=completion_rate,
            procrastination_index=procrastination_index,
        )
        event_type = (
            EventType.REPLAN_FINE_GRAINED
            if strategy == ReplanStrategy.FINE
            else EventType.REPLAN_COARSE_GRAINED
        )
        await self._event_bus.publish(
            DomainEvent.build(
                event_type=event_type,
                source="sextant",
                payload_model=decision_payload,
                correlation_id=event.event_id,
            )
        )
