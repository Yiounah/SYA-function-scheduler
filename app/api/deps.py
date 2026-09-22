"""Request-scoped access to the Voyage runtime container."""

from __future__ import annotations

from fastapi import Request

from app.agents.voyage.engine import AppContainer


def get_container(request: Request) -> AppContainer:
    """Resolve the service container from application state."""

    return request.app.state.container
