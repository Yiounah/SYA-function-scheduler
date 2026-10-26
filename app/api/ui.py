"""Serve the FocusFlow desktop UI."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

router = APIRouter()
APP_UI = Path(__file__).resolve().parents[1] / "static" / "index.html"


@router.get("/", include_in_schema=False)
async def app_ui() -> FileResponse:
    """Serve the FocusFlow desktop UI."""

    return FileResponse(APP_UI)


@router.get('/static/{filename}', include_in_schema=False)
async def app_asset(filename: str) -> FileResponse:
    """Serve only the two public UI assets through the same runtime gate."""
    if filename not in {'app.js', 'styles.css'} or not (APP_UI.parent / filename).is_file():
        raise HTTPException(status_code=404, detail='Asset not found')
    return FileResponse(APP_UI.parent / filename)
