"""WebSocket transport for the desktop App."""

from __future__ import annotations

from fastapi import FastAPI, WebSocket


def register_websocket(app: FastAPI) -> None:
    """Mount the tree-sync websocket used by the FocusFlow UI."""

    @app.websocket("/ws/tree")
    async def tree_stream(websocket: WebSocket) -> None:
        """Push tree mutations and status events to the desktop UI."""

        container = websocket.app.state.container
        await container.ws_sync_service.serve(websocket)
