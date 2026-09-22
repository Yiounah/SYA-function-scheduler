"""Health probe used by Electron and the SYA function host."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health() -> dict[str, Any]:
    """Health probe used by the Electron shell at startup."""

    return {
        "ok": True,
        "data": {"status": "ok", "functionId": "scheduler", "version": "0.1.0"},
        "error": None,
    }
