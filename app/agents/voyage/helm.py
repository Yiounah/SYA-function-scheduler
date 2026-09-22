"""Helm: record a human-executed leaf as an observation.

FocusFlow is a desktop App. The human does the work; Helm does not call tools.
A status PATCH is the observation that closes one step.
"""

from __future__ import annotations

from app.core.event_bus import AsyncEventBus
from app.core.memory_store import MemoryStore
from app.models.domain_events import (
    DomainEvent,
    EventType,
    StatusUpdatePayload,
    TaskStatusUpdatedPayload,
)
from app.models.voyage import VoyagePhase


class Helm:
    """Apply human status updates to the live tree and emit observations."""

    def __init__(
        self,
        *,
        event_bus: AsyncEventBus,
        memory_store: MemoryStore,
    ) -> None:
        self._event_bus = event_bus
        self._memory_store = memory_store
        self._registered = False

    def register(self) -> None:
        """Attach execution handlers to the event bus."""
        if self._registered:
            return

        self._event_bus.subscribe(EventType.STATUS_UPDATE, self._on_status_update)
        self._registered = True

    async def _on_status_update(self, event: DomainEvent) -> None:
        """Apply a client status update and emit the derived observation."""

        payload = StatusUpdatePayload.model_validate(event.payload)
        transition = await self._memory_store.update_task_status(
            task_id=payload.task_id,
            new_status=payload.status,
            actual_time=payload.actual_time,
        )
        await self._memory_store.set_voyage_phase(VoyagePhase.EXECUTING)

        updated_payload = TaskStatusUpdatedPayload(
            task_id=transition.task_id,
            parent_id=transition.parent_id,
            old_status=transition.old_status,
            new_status=transition.new_status,
            is_leaf=transition.is_leaf,
            estimated_time=transition.estimated_time,
            actual_time=transition.actual_time,
            transitioned_to_terminal_leaf=transition.transitioned_to_terminal_leaf,
        )
        await self._event_bus.publish(
            DomainEvent.build(
                event_type=EventType.TASK_STATUS_UPDATED,
                source="helm",
                payload_model=updated_payload,
                correlation_id=event.event_id,
            )
        )
