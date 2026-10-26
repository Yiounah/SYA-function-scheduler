"""FocusFlow desktop App: thin FastAPI factory around the Voyage runtime."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.agents.voyage.engine import AppContainer, build_container
from app.api import register_routes
from app.api.runtime_auth import RuntimeAuthMiddleware
from app.core.config import get_settings

# Re-exported for tests and compatibility shims.
from app.api.deps import get_container
from app.api.schemas import EventAckResponse, InitTaskRequest, UpdateTaskStatusRequest
from app.services.planning import publish_init_task, publish_status_update

__all__ = [
    "app",
    "AppContainer",
    "build_container",
    "get_container",
    "InitTaskRequest",
    "UpdateTaskStatusRequest",
    "EventAckResponse",
    "publish_init_task",
    "publish_status_update",
]


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Start and stop the local Voyage runtime for the desktop App."""

    settings = get_settings()
    logging.getLogger("uvicorn.error").info(
        "LLM configured model=%s base_url=%s api_key_set=%s",
        settings.openai_model,
        settings.openai_base_url,
        bool(settings.openai_api_key),
    )
    container = build_container(settings)
    container.register()
    from app.services.planner_desk import PlannerDesk, restore_desk

    container.planner_desk = PlannerDesk()
    await restore_desk(container, container.planner_desk)

    async def save_shared_desk() -> None:
        from app.services.planner_desk import persist

        desk = container.planner_desk
        desk.revision += 1
        try:
            await persist(container, desk)
        except OSError:
            desk.revision -= 1
            raise
        desk.emit("task.updated", revision=desk.revision)
        desk.emit("timeline.changed", revision=desk.revision)

    container.memory_store.set_after_change(save_shared_desk)
    from app.models.domain_events import EventType

    async def record_completion(event) -> None:
        if event.payload.get("new_status") == "BLOCKED":
            container.planner_desk.emit("schedule.granularity_suggested", taskId=event.payload.get("task_id"), reason="blocked", eventId=event.event_id)
        if event.payload.get("new_status") == "DONE" and event.payload.get("old_status") != "DONE":
            container.planner_desk.emit("schedule.task_completed", taskId=event.payload.get("task_id"), eventId=event.event_id, correlationId=event.correlation_id)
            from app.services.planner_desk import persist
            await persist(container, container.planner_desk)

    container.event_bus.subscribe(EventType.TASK_STATUS_UPDATED, record_completion)
    await container.event_bus.start()
    app.state.container = container

    try:
        yield
    finally:
        await container.event_bus.stop()


app = FastAPI(
    title="FocusFlow",
    version="0.1.0",
    description=(
        "Planner API for other SYA modules. "
        "/api/v1 keeps the project list, revise, translation, tree, and voyage. "
        "/api/scheduler keeps the host bridge and still reads the active tree."
    ),
    lifespan=lifespan,
)
app.add_middleware(RuntimeAuthMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_methods=["*"],
    allow_headers=["*"],
)
register_routes(app)
