"""FocusFlow app backend: event bus, planning services, and desktop UI APIs."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any, AsyncIterator

from fastapi import Depends, FastAPI, HTTPException, Request, WebSocket
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field

from app.config import Settings, get_settings
from app.core.cognitive_engine import CognitiveEngine, OpenAICompatiblePlannerGateway
from app.core.event_bus import AsyncEventBus
from app.core.memory_store import MemoryStore
from app.core.rolling_planner import RollingWavePlanner
from app.models.domain_events import (
    DomainEvent,
    EventType,
    NewTaskRequestPayload,
    StatusUpdatePayload,
)
from app.models.task_tree import TaskStatus
from app.services.task_manager import TaskManager
from app.services.ws_sync_service import WebSocketSyncService

APP_UI = Path(__file__).resolve().parent / "static" / "index.html"


class InitTaskRequest(BaseModel):
    """Request body for a new long-horizon planning run."""

    model_config = ConfigDict(extra="forbid", strict=True)

    goal: str = Field(min_length=1)
    persona: str = Field(default="balanced", min_length=1)


class UpdateTaskStatusRequest(BaseModel):
    """Request body for leaf-task status updates."""

    model_config = ConfigDict(extra="forbid")

    status: TaskStatus
    actual_time: float | None = Field(default=None, ge=0)


class EventAckResponse(BaseModel):
    """Acknowledgement that a planning event was queued."""

    model_config = ConfigDict(extra="forbid", strict=True)

    accepted: bool
    event_id: str


@dataclass(slots=True)
class AppContainer:
    """Runtime service graph used by the desktop app."""

    settings: Settings
    event_bus: AsyncEventBus
    memory_store: MemoryStore
    cognitive_engine: CognitiveEngine
    rolling_planner: RollingWavePlanner
    task_manager: TaskManager
    ws_sync_service: WebSocketSyncService


def build_container(settings: Settings) -> AppContainer:
    """Construct and wire all application services."""

    event_bus = AsyncEventBus()
    memory_store = MemoryStore(event_history_maxlen=settings.event_history_maxlen)

    llm_gateway = OpenAICompatiblePlannerGateway(settings)
    cognitive_engine = CognitiveEngine(
        event_bus=event_bus,
        memory_store=memory_store,
        llm_gateway=llm_gateway,
    )
    rolling_planner = RollingWavePlanner(event_bus=event_bus, memory_store=memory_store)
    task_manager = TaskManager(
        event_bus=event_bus,
        memory_store=memory_store,
        settings=settings,
    )
    ws_sync_service = WebSocketSyncService(event_bus=event_bus)

    return AppContainer(
        settings=settings,
        event_bus=event_bus,
        memory_store=memory_store,
        cognitive_engine=cognitive_engine,
        rolling_planner=rolling_planner,
        task_manager=task_manager,
        ws_sync_service=ws_sync_service,
    )


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Start and stop asynchronous infrastructure for the app."""

    settings = get_settings()
    logging.getLogger("uvicorn.error").info(
        "LLM configured model=%s base_url=%s api_key_set=%s",
        settings.openai_model,
        settings.openai_base_url,
        bool(settings.openai_api_key),
    )
    container = build_container(settings)

    container.cognitive_engine.register()
    container.rolling_planner.register()
    container.task_manager.register()
    container.ws_sync_service.register()
    container.event_bus.subscribe(None, container.memory_store.append_event)

    await container.event_bus.start()
    app.state.container = container

    try:
        yield
    finally:
        await container.event_bus.stop()


app = FastAPI(
    title="FocusFlow",
    version="0.1.0",
    lifespan=lifespan,
)


def get_container(request: Request) -> AppContainer:
    """Resolve the service container from application state."""

    return request.app.state.container


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


@app.get("/", include_in_schema=False)
async def app_ui() -> FileResponse:
    """Serve the FocusFlow desktop UI."""

    return FileResponse(APP_UI)


@app.get("/health")
async def health() -> dict[str, Any]:
    """Health probe used by the Electron shell at startup."""

    return {
        "ok": True,
        "data": {"status": "ok", "functionId": "scheduler", "version": "0.1.0"},
        "error": None,
    }


@app.post("/api/v1/tasks/init", response_model=EventAckResponse)
async def init_task(
    body: InitTaskRequest,
    container: AppContainer = Depends(get_container),
) -> EventAckResponse:
    """Submit a long-horizon goal and persona."""

    return await publish_init_task(body, container, source="app")


@app.patch("/api/v1/tasks/{task_id}/status", response_model=EventAckResponse)
async def update_task_status(
    task_id: str,
    body: UpdateTaskStatusRequest,
    container: AppContainer = Depends(get_container),
) -> EventAckResponse:
    """Update a leaf task status for execution tracking."""

    return await publish_status_update(
        task_id=task_id,
        body=body,
        container=container,
        source="app",
    )


@app.get("/api/v1/tasks/tree")
async def get_task_tree(
    container: AppContainer = Depends(get_container),
) -> dict:
    """Return the current task-tree snapshot for the app UI."""

    tree = await container.memory_store.get_task_tree_snapshot()
    if tree is None:
        raise HTTPException(status_code=404, detail="Task tree is not initialized")
    return tree.model_dump(mode="json")


@app.websocket("/ws/tree")
async def tree_stream(websocket: WebSocket) -> None:
    """Push tree mutations and status events to the desktop UI."""

    container: AppContainer = websocket.app.state.container
    await container.ws_sync_service.serve(websocket)
