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
