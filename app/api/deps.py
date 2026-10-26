"""Request-scoped access to the Voyage runtime container."""

from __future__ import annotations

from fastapi import Request

from app.agents.voyage.engine import AppContainer


async def get_container(request: Request) -> AppContainer:
    """Resolve the service container from application state."""

    container = request.app.state.container
    from app.services.planner_desk import refresh_desk
    await refresh_desk(container)
    return container
