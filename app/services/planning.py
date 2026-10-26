"""Planning commands used by both the desktop App and the SYA bridge."""

from __future__ import annotations

from fastapi import HTTPException

from app.agents.voyage.engine import AppContainer
from app.api.schemas import (
    EventAckResponse,
    InitTaskRequest,
    TranslateRequest,
    TranslateResponse,
    UpdateTaskStatusRequest,
)
from app.models.domain_events import (
    DomainEvent,
    EventType,
    NewTaskRequestPayload,
    ReplanDecisionPayload,
    StatusUpdatePayload,
)

# 这里的publish_init_task是用来发布一个新任务请求的,用来真正的发布事件
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
        payload_model=NewTaskRequestPayload(
            goal=body.goal,
            persona=body.persona,
            deadline_days=body.deadline_days,
        ),
    )
    await container.event_bus.publish(event)
    return EventAckResponse(accepted=True, event_id=event.event_id)


async def publish_revise_task(
    *,
    task_id: str,
    body: InitTaskRequest,
    container: AppContainer,
    source: str,
) -> EventAckResponse:
    """Re-split unfinished work on one project. Completed nodes stay where they are."""

    await container.memory_store.update_plan_context(
        task_id=task_id,
        goal=body.goal,
        persona=body.persona,
        deadline_days=body.deadline_days,
    )
    event = DomainEvent.build(
        event_type=EventType.REPLAN_FINE_GRAINED,
        source=source,
        payload_model=ReplanDecisionPayload(
            target_node_id=task_id,
            completion_rate=0.0,
            procrastination_index=0.0,
        ),
    )
    await container.event_bus.publish(event)
    await container.event_bus.join()
    return EventAckResponse(accepted=True, event_id=event.event_id)


async def translate_task_copy(body: TranslateRequest, container: AppContainer) -> TranslateResponse:
    """Translate display copy. The stored task tree is not modified."""

    translated = await container.llm_gateway.translate_nodes(
        target=body.target,
        nodes=[node.model_dump() for node in body.nodes],
    )
    return TranslateResponse.model_validate({"nodes": translated})


async def publish_status_update(
    *,
    task_id: str,
    body: UpdateTaskStatusRequest,
    container: AppContainer,
    source: str,
) -> EventAckResponse:
    """Publish a task status update into the event bus."""

    subtree = await container.memory_store.get_subtree_snapshot(task_id)
    if subtree is None:
        raise HTTPException(status_code=404, detail="Task not found")
    if subtree.get("children"):
        raise HTTPException(status_code=422, detail="Only checklist items have an execution status")

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
    await container.event_bus.join()
    error = container.event_bus.failures.pop(event.event_id, None)
    if error:
        raise HTTPException(status_code=409 if error == "ConcurrentPlannerWrite" else 503, detail="Task could not be saved; reload before retrying")
    return EventAckResponse(accepted=True, event_id=event.event_id)
