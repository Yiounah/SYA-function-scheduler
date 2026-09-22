"""Desktop App v1 routes. Thin wrappers over the planning service."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_container
from app.api.schemas import EventAckResponse, InitTaskRequest, UpdateTaskStatusRequest
from app.agents.voyage.engine import AppContainer
from app.services.planning import publish_init_task, publish_status_update

router = APIRouter()


@router.post("/api/v1/tasks/init", response_model=EventAckResponse)
async def init_task(
    body: InitTaskRequest,
    container: AppContainer = Depends(get_container),
) -> EventAckResponse:
    """Submit a long-horizon goal and persona."""

    return await publish_init_task(body, container, source="app")


@router.patch("/api/v1/tasks/{task_id}/status", response_model=EventAckResponse)
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


@router.get("/api/v1/tasks/tree")
async def get_task_tree(
    container: AppContainer = Depends(get_container),
) -> dict:
    """Return the current task-tree snapshot for the app UI."""

    tree = await container.memory_store.get_task_tree_snapshot()
    if tree is None:
        raise HTTPException(status_code=404, detail="Task tree is not initialized")
    return tree.model_dump(mode="json")


@router.get("/api/v1/voyage")
async def get_voyage(
    container: AppContainer = Depends(get_container),
) -> dict:
    """Return the active Voyage state machine snapshot."""

    voyage = await container.memory_store.get_voyage()
    if voyage is None:
        raise HTTPException(status_code=404, detail="Voyage is not initialized")
    return voyage.model_dump(mode="json")
