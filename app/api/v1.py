"""Desktop App v1 routes. Thin wrappers over the planning service."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_container
from app.api.schemas import (
    EventAckResponse,
    InitTaskRequest,
    TranslateRequest,
    TranslateResponse,
    UpdateTaskStatusRequest,
)
from app.agents.voyage.engine import AppContainer
from app.services.planner_desk import public_tree
from app.services.planning import (
    publish_init_task,
    publish_revise_task,
    publish_status_update,
    translate_task_copy,
)

router = APIRouter()


@router.post("/api/v1/tasks/init", response_model=EventAckResponse)
async def init_task(
    body: InitTaskRequest,
    container: AppContainer = Depends(get_container),
) -> EventAckResponse:
    """Submit a long-horizon goal and persona."""

    return await publish_init_task(body, container, source="app")


@router.post("/api/v1/tasks/{task_id}/revise", response_model=EventAckResponse)
async def revise_task(
    task_id: str,
    body: InitTaskRequest,
    container: AppContainer = Depends(get_container),
) -> EventAckResponse:
    """Re-split unfinished work on the selected project only."""

    try:
        return await publish_revise_task(
            task_id=task_id,
            body=body,
            container=container,
            source="app",
        )
    except (KeyError, ValueError) as exc:
        raise HTTPException(status_code=404, detail="Project is not initialized") from exc


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


@router.post("/api/v1/tasks/translate", response_model=TranslateResponse)
async def translate_tasks(
    body: TranslateRequest,
    container: AppContainer = Depends(get_container),
) -> TranslateResponse:
    """Translate task wording for the current interface language."""

    return await translate_task_copy(body, container)


@router.get("/api/v1/projects")
async def list_projects(
    container: AppContainer = Depends(get_container),
) -> dict:
    """Return every concurrent 课题. Oldest first. Does not replace any of them."""

    projects = await container.memory_store.list_projects()
    return {
        "projects": [
            {
                "voyage_id": project.voyage.voyage_id,
                "goal": project.voyage.goal,
                "persona": project.voyage.persona,
                "deadline_days": project.voyage.deadline_days,
                "tree": public_tree(project.tree, project.voyage.voyage_id),
                "revision": container.planner_desk.revision,
                "started_at": project.voyage.started_at.isoformat(),
                "generationMode": project.voyage.generation_mode,
            }
            for project in projects
        ]
    }


@router.get("/api/v1/tasks/tree")
async def get_task_tree(
    projectId: str | None = None,
    container: AppContainer = Depends(get_container),
) -> dict:
    """Return one project tree, or the active tree when no project is selected."""

    desk = getattr(container, "planner_desk", None)
    revision = getattr(desk, "revision", 0)
    if projectId:
        for project in await container.memory_store.list_projects():
            if projectId in {project.voyage.voyage_id, project.tree.task_id}:
                payload = public_tree(project.tree, project.voyage.voyage_id)
                payload["projectId"] = project.voyage.voyage_id
                payload["revision"] = revision
                return payload
        raise HTTPException(status_code=404, detail="Task tree is not initialized")
    tree = await container.memory_store.get_task_tree_snapshot()
    if tree is None:
        raise HTTPException(status_code=404, detail="Task tree is not initialized")
    owner = next((p for p in await container.memory_store.list_projects() if p.tree.task_id == tree.task_id), None)
    payload = public_tree(tree, owner.voyage.voyage_id if owner else None)
    payload["revision"] = revision
    return payload


@router.get("/api/v1/voyage")
async def get_voyage(
    container: AppContainer = Depends(get_container),
) -> dict:
    """Return the active Voyage state machine snapshot."""

    voyage = await container.memory_store.get_voyage()
    if voyage is None:
        raise HTTPException(status_code=404, detail="Voyage is not initialized")
    return voyage.model_dump(mode="json")
