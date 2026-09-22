"""Planning commands used by both the desktop App and the SYA bridge."""

from __future__ import annotations

from app.agents.voyage.engine import AppContainer
from app.api.schemas import EventAckResponse, InitTaskRequest, UpdateTaskStatusRequest
from app.models.domain_events import DomainEvent, EventType, NewTaskRequestPayload, StatusUpdatePayload


async def publish_init_task(
    body: InitTaskRequest,
    container: AppContainer,
    *,
    source: str,
) -> EventAckResponse:
    """Publish a new planning request into the event bus."""

    event = DomainEvent.build(
        event_type=EventType.NEW_TASK_REQUEST,
        source=source,
        payload_model=NewTaskRequestPayload(goal=body.goal, persona=body.persona),
    )
    await container.event_bus.publish(event)
    return EventAckResponse(accepted=True, event_id=event.event_id)


async def publish_status_update(
    *,
    task_id: str,
    body: UpdateTaskStatusRequest,
    container: AppContainer,
    source: str,
) -> EventAckResponse:
    """Publish a task status update into the event bus."""

    event = DomainEvent.build(
        event_type=EventType.STATUS_UPDATE,
        source=source,
        payload_model=StatusUpdatePayload(
            task_id=task_id,
            status=body.status,
            actual_time=body.actual_time,
        ),
    )
    await container.event_bus.publish(event)
    return EventAckResponse(accepted=True, event_id=event.event_id)
