"""Serve the FocusFlow desktop UI."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import FileResponse

router = APIRouter()
APP_UI = Path(__file__).resolve().parents[1] / "static" / "index.html"


@router.get("/", include_in_schema=False)
async def app_ui() -> FileResponse:
    """Serve the FocusFlow desktop UI."""

    return FileResponse(APP_UI)
