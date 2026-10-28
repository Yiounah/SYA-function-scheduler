"""SYA-UI function-bridge routes consumed by Electron IPC.

These endpoints keep the FocusFlow planner on the same contract as
`app/src/features/scheduler/api.ts`. Response shapes match the renderer types
in `app/src/types/electron.d.ts` so Dashboard integration tests can call
`decompose` and `timeline.get` without a second adapter layer.
"""

from __future__ import annotations

import asyncio
import json
from datetime import date
from typing import Any, AsyncIterator

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, ConfigDict, Field

from app.agents.voyage.engine import AppContainer
from app.api.deps import get_container
from app.api.schemas import InitTaskRequest, UpdateTaskStatusRequest
from app.models.task_tree import TaskNode, TaskStatus
from app.services.planner_desk import (
    ConcurrentPlannerWrite,
    commit_draft,
    config_view,
    confirm_tree,
    persist,
    preview_granularity,
    preview_plan,
    preview_routine,
    timeline_window,
    cancel_draft,
    update_config,
)
from app.services.calendar import build_slots, window
from app.services.planning import publish_init_task, publish_status_update
from app.services.timeline import (
    minutes,
    node_to_task,
    parse_task_status,
    resolve_task_id,
    timeline_for_tree,
)

FUNCTION_MANIFEST: dict[str, Any] = {
    "id": "scheduler",
    "version": "0.1.0",
    "runtime": "local-http",
    "entry": {"command": "bin/scheduler-server", "args": []},
    "api": {
        "basePath": "/api/scheduler",
        "health": {"method": "GET", "path": "/health"},
        "events": {"transport": "sse", "path": "/api/scheduler/events"},
    },
    "capabilities": [
        "task-decomposition",
        "timeline-scheduling",
        "task-storage",
        "hierarchical-task-tree",
        "custom-task-granularity",
        "rolling-wave-planning",
        "adaptive-replanning",
        "voyage-runtime",
    ],
    "events": ["task.created", "task.updated", "task.deleted", "timeline.changed", "schedule.plan_generated", "schedule.plan_confirmed", "schedule.granularity_requested", "schedule.granularity_applied", "schedule.granularity_suggested", "schedule.routine_suggested", "schedule.routine_applied", "schedule.task_completed"],
    "permissions": ["llm-api"],
}

router = APIRouter()


class FunctionResponse(BaseModel):
    """Standard SYA function response envelope."""

    model_config = ConfigDict(extra="forbid")

    ok: bool
    data: Any | None = None
    error: dict[str, Any] | None = None


class DecomposeRequest(BaseModel):
    """Natural-language decomposition request from the SYA Dashboard."""

    model_config = ConfigDict(extra="forbid", strict=True)

    input: str = Field(min_length=1)
    attachments: list[str] = Field(default_factory=list)


class ReorderTasksRequest(BaseModel):
    """Complete sibling order used by the SYA function client."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    task_ids: list[str] = Field(alias="taskIds", min_length=1, description="Every child of one parent, exactly once, in the desired order.")


def function_ok(data: Any) -> FunctionResponse:
    """Wrap successful function data in the SYA envelope."""

    return FunctionResponse(ok=True, data=data)


@router.get("/manifest")
async def manifest() -> dict[str, Any]:
    return FUNCTION_MANIFEST


@router.post("/api/scheduler/decompose", response_model=FunctionResponse)
async def scheduler_decompose(
    body: DecomposeRequest,
    container: AppContainer = Depends(get_container),
) -> FunctionResponse:
    ack = await publish_init_task(
        InitTaskRequest(goal=body.input, persona="balanced"),
        container,
        source="scheduler_api",
    )
    await container.event_bus.join()
    tree = await container.memory_store.get_task_tree_snapshot()
    tasks = [node_to_task(node) for node in (tree.iter_leaves() if tree else [])]
    await persist(container, container.planner_desk)
    return function_ok(
        {
            "tasks": tasks,
            "timeline": timeline_for_tree(tree),
            "eventId": ack.event_id,
        }
    )


@router.get("/api/scheduler/tasks", response_model=FunctionResponse)
async def scheduler_list_tasks(
    status: str | None = None,
    projectId: str | None = None,
    container: AppContainer = Depends(get_container),
) -> FunctionResponse:
    projects = await container.memory_store.list_projects()
    if projectId and projectId != "all":
        projects = [p for p in projects if projectId in {p.voyage.voyage_id, p.tree.task_id}]
    tasks = [{**node_to_task(node), "projectId": project.voyage.voyage_id} for project in projects for node in project.tree.iter_nodes() if node.task_id != project.tree.task_id]
    if status:
        wanted = {
            "in_progress": "in_progress",
            "active": "in_progress",
            "completed": "completed",
            "pending": "pending",
        }.get(status, status)
        tasks = [task for task in tasks if task["status"] == wanted]
    return function_ok(tasks)


@router.get("/api/scheduler/tasks/{taskId}", response_model=FunctionResponse)
async def scheduler_get_task(
    taskId: str,
    request: Request,
    container: AppContainer = Depends(get_container),
) -> FunctionResponse:
    task_id = resolve_task_id(taskId, dict(request.query_params))
    projects = await container.memory_store.list_projects()
    owner = next((p for p in projects if p.tree.find_node(task_id)), None)
    node = owner.tree.find_node(task_id) if owner else None
    if node is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return function_ok({**node_to_task(node), "projectId": owner.voyage.voyage_id})


@router.put("/api/scheduler/tasks/{taskId}", response_model=FunctionResponse)
async def scheduler_update_task(
    taskId: str,
    body: dict[str, Any],
    container: AppContainer = Depends(get_container),
) -> FunctionResponse:
    task_id = resolve_task_id(taskId, body)
    status = parse_task_status(body.get("status"))
    if "status" in body and status is None:
        raise HTTPException(status_code=422, detail="Unknown task status")
    if status is not None:
        actual_minutes = body.get("actualMinutes")
        await publish_status_update(
            task_id=task_id,
            body=UpdateTaskStatusRequest(
                status=status,
                actual_time=(float(actual_minutes) / 60 if actual_minutes else None),
            ),
            container=container,
            source="scheduler_api",
        )

    def mutator(root: TaskNode) -> dict[str, Any]:
        node = root.find_node(task_id)
        if node is None:
            raise KeyError(task_id)
        if body.get("title"):
            node.title = str(body["title"])
        if "description" in body:
            node.description = str(body.get("description") or "")
        if "deadline" in body:
            node.deadline = body.get("deadline") or None
        if "scheduledDate" in body:
            node.scheduled_date = body.get("scheduledDate") or None
        return node_to_task(node)

    try:
        task = await container.memory_store.mutate_tree(mutator)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Task not found") from exc
    await container.event_bus.join()
    tree = await container.memory_store.get_task_tree_snapshot()
    node = tree.find_node(task_id) if tree is not None else None
    await persist(container, container.planner_desk)
    return function_ok(node_to_task(node) if node is not None else task)


@router.delete("/api/scheduler/tasks/{taskId}", response_model=FunctionResponse)
async def scheduler_delete_task(
    taskId: str,
    body: dict[str, Any] | None = None,
    container: AppContainer = Depends(get_container),
) -> FunctionResponse:
    task_id = resolve_task_id(taskId, body or {})

    def remove_from(parent: TaskNode) -> bool:
        for index, child in enumerate(parent.children):
            if child.task_id == task_id:
                del parent.children[index]
                object.__setattr__(parent, "is_leaf", len(parent.children) == 0)
                return True
            if remove_from(child):
                return True
        return False

    def mutator(root: TaskNode) -> dict[str, str]:
        if root.task_id == task_id:
            raise ValueError("Cannot delete root task")
        if not remove_from(root):
            raise KeyError(task_id)
        return {"taskId": task_id}

    try:
        return function_ok(await container.memory_store.mutate_tree(mutator))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Task not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/api/scheduler/timeline", response_model=FunctionResponse)
async def scheduler_timeline(
    request: Request,
    container: AppContainer = Depends(get_container),
) -> FunctionResponse:
    query = {key: value for key, value in request.query_params.items()}
    projects = await container.memory_store.list_projects()
    project_id = query.get("projectId")
    if project_id and project_id != "all":
        projects = [p for p in projects if project_id in {p.voyage.voyage_id, p.tree.task_id}]
    elif project_id != "all":
        active = await container.memory_store.get_task_tree_snapshot()
        projects = [p for p in projects if active and p.tree.task_id == active.task_id]
    try:
        # Allocate against all projects before filtering, so per-project reads
        # cannot accidentally claim the same shared work period.
        slots = build_slots(await container.memory_store.list_projects(), container.planner_desk.overrides, container.planner_desk.slots)
        ids = {p.voyage.voyage_id for p in projects}
        return function_ok(window([s for s in slots if s["projectId"] in ids], query, container.planner_desk.overrides))
    except (ValueError, TypeError, KeyError) as exc:
        raise HTTPException(status_code=422, detail="Invalid timeline range, timezone, or routine") from exc


@router.post("/api/scheduler/tasks/reorder", response_model=FunctionResponse)
async def scheduler_reorder_tasks(
    body: ReorderTasksRequest,
    container: AppContainer = Depends(get_container),
) -> FunctionResponse:
    order = {task_id: index for index, task_id in enumerate(body.task_ids)}
    if len(order) != len(body.task_ids):
        raise HTTPException(status_code=422, detail="Task order cannot contain duplicate IDs")
    async with container.planner_desk.lock:
        projects = await container.memory_store.list_projects()
        owner = next((p for p in projects if all(p.tree.find_node(task_id) for task_id in body.task_ids)), None)
        if owner is None:
            raise HTTPException(status_code=422, detail="Reordered tasks must belong to the same existing project")
        parent = next((node for node in owner.tree.iter_nodes() if {child.task_id for child in node.children} == set(order)), None)
        if parent is None:
            raise HTTPException(status_code=422, detail="Task order must contain every child of one parent exactly once")
        if [child.task_id for child in parent.children] == body.task_ids:
            return function_ok(None)

        def mutator(root: TaskNode) -> None:
            if root.task_id != owner.tree.task_id:
                raise KeyError(owner.tree.task_id)
            current = root.find_node(parent.task_id)
            if current is None or {child.task_id for child in current.children} != set(order):
                raise HTTPException(status_code=422, detail="Task siblings changed; reload before reordering")
            current.children.sort(key=lambda child: order[child.task_id])

        # The store callback advances revision and persists the tree together
        # with rebuilt pending slots; executed slots and the active project stay put.
        try:
            await container.memory_store.mutate_tree(mutator, activate=False)
        except OSError as exc:
            raise HTTPException(
                status_code=409 if isinstance(exc, ConcurrentPlannerWrite) else 503,
                detail="Task order could not be saved; reload before retrying",
            ) from exc
    return function_ok(None)


@router.get("/api/scheduler/stats", response_model=FunctionResponse)
async def scheduler_stats(container: AppContainer = Depends(get_container)) -> FunctionResponse:
    tree = await container.memory_store.get_task_tree_snapshot()
    leaves = list(tree.iter_leaves()) if tree is not None else []
    completed = [leaf for leaf in leaves if leaf.status == TaskStatus.DONE]
    return function_ok(
        {
            "date": date.today().isoformat(),
            "completedCount": len(completed),
            "totalEstimateMinutes": sum(minutes(leaf.estimated_time) for leaf in leaves),
            "actualMinutes": sum(minutes(leaf.actual_time) for leaf in leaves if leaf.actual_time),
        }
    )


@router.get("/api/scheduler/config", response_model=FunctionResponse)
async def scheduler_get_config(container: AppContainer = Depends(get_container)) -> FunctionResponse:
    return function_ok(config_view(container, container.planner_desk))


@router.put("/api/scheduler/config", response_model=FunctionResponse)
async def scheduler_update_config(
    body: dict[str, Any],
    container: AppContainer = Depends(get_container),
) -> Any:
    return _bridge_result(await update_config(container, container.planner_desk, body))


class PlanPreviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    input: str | None = None
    goal: str | None = None
    projectId: str | None = None
    granularity: str | None = None
    availability: dict[str, Any] | None = None
    timezone: str | None = None
    attachments: list[str] = Field(default_factory=list)
    tree: dict[str, Any] | None = None
    expectedRevision: int | None = Field(default=None, ge=0)
    persona: str | None = None
    deadline_days: int | None = Field(default=None, ge=1, le=3650)
    allowSample: bool = False


class PlanConfirmRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tree: dict[str, Any]


class PlanCommitRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expectedRevision: int = Field(ge=0, strict=True)
    requestId: str = Field(min_length=1, max_length=200)


class GranularityPreviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    projectId: str | None = None
    taskId: str = Field(min_length=1)
    level: str = Field(default="finer", description="Fixed finer/standard/coarser presets (25/45/90), or custom with targetMinutes.")
    reason: str | None = None
    focusSessionId: str | None = None
    targetMinutes: int | None = Field(default=None, strict=True, ge=5, le=120)


class RoutinePreviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    workStart: str | None = None
    workEnd: str | None = None
    rest: str | None = None
    date: str | None = None
    projectId: str | None = None
    timezone: str | None = None
    focusflow: dict[str, Any] | None = None
    dailyGranularity: str | None = None
    focusMinutes: int | None = Field(default=None, strict=True, ge=5, le=180)
    breakMinutes: int | None = Field(default=None, strict=True, ge=0, le=60)
    recoveryMinutes: int | None = Field(default=None, strict=True, ge=0, le=120)
    cyclesBeforeRecovery: int | None = Field(default=None, strict=True, ge=1, le=12)


def _bridge_result(result: Any) -> Any:
    if isinstance(result, JSONResponse):
        return result
    return function_ok(result)


@router.post("/api/scheduler/plans/preview")
async def scheduler_preview_plan(
    body: PlanPreviewRequest,
    container: AppContainer = Depends(get_container),
) -> Any:
    result = await preview_plan(container, container.planner_desk, body.model_dump())
    return _bridge_result(result)


@router.post("/api/scheduler/plans/confirm")
async def scheduler_confirm_plan(
    body: PlanConfirmRequest,
    container: AppContainer = Depends(get_container),
) -> Any:
    result = await confirm_tree(container, container.planner_desk, body.tree)
    return _bridge_result(result)


@router.post("/api/scheduler/plans/{draftId}/commit")
async def scheduler_commit_plan(
    draftId: str,
    body: PlanCommitRequest,
    container: AppContainer = Depends(get_container),
) -> Any:
    result = await commit_draft(container, container.planner_desk, draftId, body.model_dump())
    return _bridge_result(result)


@router.delete("/api/scheduler/plans/{draftId}")
async def scheduler_cancel_plan(draftId: str, container: AppContainer = Depends(get_container)) -> Any:
    return function_ok(await cancel_draft(container.planner_desk, draftId))


@router.post("/api/scheduler/granularity/preview")
async def scheduler_preview_granularity(
    body: GranularityPreviewRequest,
    container: AppContainer = Depends(get_container),
) -> Any:
    result = await preview_granularity(container, container.planner_desk, body.model_dump())
    return _bridge_result(result)


@router.post("/api/scheduler/routine/preview")
async def scheduler_preview_routine(
    body: RoutinePreviewRequest,
    container: AppContainer = Depends(get_container),
) -> Any:
    result = await preview_routine(container, container.planner_desk, body.model_dump())
    return _bridge_result(result)


@router.get("/api/scheduler/events")
async def scheduler_events(request: Request, container: AppContainer = Depends(get_container)) -> StreamingResponse:
    queue: asyncio.Queue = asyncio.Queue(maxsize=100)
    desk = container.planner_desk

    async def stream() -> AsyncIterator[str]:
        desk.subscribers.add(queue)
        try:
            yield 'event: ready\ndata: {"event":"ready","payload":{"functionId":"scheduler"}}\n\n'
            while not await request.is_disconnected():
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=15)
                    yield f"id: {event['id']}\nevent: {event['event']}\ndata: {json.dumps(event)}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            desk.subscribers.discard(queue)

    return StreamingResponse(stream(), media_type="text/event-stream")


@router.get("/api/scheduler/telemetry", response_model=FunctionResponse)
async def scheduler_telemetry(container: AppContainer = Depends(get_container)) -> FunctionResponse:
    return function_ok({"events": list(container.planner_desk.events), "revision": container.planner_desk.revision})


@router.get("/api/scheduler/actions", response_model=FunctionResponse)
async def function_actions() -> FunctionResponse:
    return function_ok(
        {
            "functionId": FUNCTION_MANIFEST["id"],
            "actions": [
                {"action": "health", "method": "GET", "path": "/health"},
                {"action": "manifest", "method": "GET", "path": "/manifest"},
                {"action": "decompose", "method": "POST", "path": "/api/scheduler/decompose"},
                {"action": "tasks.list", "method": "GET", "path": "/api/scheduler/tasks"},
                {"action": "tasks.get", "method": "GET", "path": "/api/scheduler/tasks/{taskId}"},
                {"action": "tasks.update", "method": "PUT", "path": "/api/scheduler/tasks/{taskId}"},
                {"action": "tasks.delete", "method": "DELETE", "path": "/api/scheduler/tasks/{taskId}"},
                {"action": "timeline.get", "method": "GET", "path": "/api/scheduler/timeline"},
                {"action": "tasks.reorder", "method": "POST", "path": "/api/scheduler/tasks/reorder"},
                {"action": "stats.get", "method": "GET", "path": "/api/scheduler/stats"},
                {"action": "config.get", "method": "GET", "path": "/api/scheduler/config"},
                {"action": "config.update", "method": "PUT", "path": "/api/scheduler/config"},
                {"action": "plans.preview", "method": "POST", "path": "/api/scheduler/plans/preview"},
                {"action": "plans.confirm", "method": "POST", "path": "/api/scheduler/plans/confirm"},
                {"action": "plans.commit", "method": "POST", "path": "/api/scheduler/plans/{draftId}/commit"},
                {"action": "plans.cancel", "method": "DELETE", "path": "/api/scheduler/plans/{draftId}"},
                {"action": "telemetry.get", "method": "GET", "path": "/api/scheduler/telemetry"},
                {"action": "granularity.preview", "method": "POST", "path": "/api/scheduler/granularity/preview"},
                {"action": "routine.preview", "method": "POST", "path": "/api/scheduler/routine/preview"},
            ],
        }
    )


def attach_sya_routes(app: FastAPI) -> None:
    """Register `/api/scheduler/*` on the FocusFlow FastAPI app."""

    app.include_router(router)
