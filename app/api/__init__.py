"""Thin HTTP routers. Routers call services; they do not own planning logic."""

from __future__ import annotations

from fastapi import FastAPI


def register_routes(app: FastAPI) -> None:
    """Mount desktop UI, health, v1, SYA scheduler, and websocket routes."""

    from app.api.health import router as health_router
    from app.api.scheduler import attach_sya_routes
    from app.api.ui import router as ui_router
    from app.api.v1 import router as v1_router
    from app.api.ws import register_websocket

    app.include_router(ui_router)
    app.include_router(health_router)
    app.include_router(v1_router)
    attach_sya_routes(app)
    register_websocket(app)
