"""SYA-UI function-bridge routes consumed by Electron IPC.

These endpoints keep the FocusFlow planner on the same contract as
`app/src/features/scheduler/api.ts`. Response shapes match the renderer types
in `app/src/types/electron.d.ts` so Dashboard integration tests can call
`decompose` and `timeline.get` without a second adapter layer.
"""

from __future__ import annotations

import asyncio
from datetime import date, datetime, timezone
from typing import Any, AsyncIterator

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field

from app.models.task_tree import TaskNode, TaskStatus

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
        "rolling-wave-planning",
        "adaptive-replanning",
    ],
    "events": ["task.created", "task.updated", "task.deleted", "timeline.changed"],
    "permissions": ["llm-api"],
}


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
    """Task reorder payload used by the SYA function client."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    task_ids: list[str] = Field(alias="taskIds", min_length=1)


def function_ok(data: Any) -> FunctionResponse:
    """Wrap successful function data in the SYA envelope."""

    return FunctionResponse(ok=True, data=data)


def _minutes(hours: float | None) -> int:
    return max(1, int(round(float(hours or 0.5) * 60)))


def _ui_task_status(status: TaskStatus) -> str:
    if status == TaskStatus.IN_PROGRESS:
        return "active"
    if status == TaskStatus.DONE:
        return "completed"
    return "pending"


def _ui_event_status(status: TaskStatus, *, index: int) -> str:
    if status == TaskStatus.DONE:
        return "completed"
    if status == TaskStatus.IN_PROGRESS or index == 0:
        return "active"
    return "upcoming"


def _clock(total_minutes: int) -> str:
    hours, minutes = divmod(max(0, total_minutes), 60)
    return f"{hours:02d}:{minutes:02d}"


def _node_to_subtask(node: TaskNode, order: int) -> dict[str, Any]:
    return {
        "id": node.task_id,
        "title": node.title,
        "estimatedMinutes": _minutes(node.estimated_time),
        "completed": node.status == TaskStatus.DONE,
        "order": order,
    }


def _node_to_task(node: TaskNode) -> dict[str, Any]:
    created = datetime.now(timezone.utc).isoformat()
    return {
        "id": node.task_id,
        "title": node.title,
        "description": node.description,
        "status": _ui_task_status(node.status),
        "priority": "medium",
        "estimatedMinutes": _minutes(node.estimated_time),
        "deadline": None,
        "createdAt": created,
        "subtasks": [_node_to_subtask(child, index) for index, child in enumerate(node.children)],
    }


def _timeline_for_tree(root: TaskNode | None) -> dict[str, Any]:
    cursor = 9 * 60
    events: list[dict[str, Any]] = []
    leaves = list(root.iter_leaves()) if root is not None else []
    for index, leaf in enumerate(leaves):
        duration = _minutes(leaf.estimated_time)
        start = cursor
        end = cursor + duration
        start_label = _clock(start)
        end_label = _clock(end)
        events.append(
            {
                "taskId": leaf.task_id,
                "title": leaf.title,
                "time": f"{start_label} - {end_label}",
                "startTime": start_label,
                "endTime": end_label,
                "status": _ui_event_status(leaf.status, index=index),
            }
        )
        cursor = end
    return {"date": date.today().isoformat(), "events": events}


def _scheduler_config(settings: Any) -> dict[str, Any]:
    return {
        "defaultDurationMinutes": 30,
        "breakDurationMinutes": 5,
        "autoScheduleEnabled": True,
        "llm": {
            "provider": "openai-compatible",
            "apiKey": "",
            "model": settings.openai_model,
            "baseUrl": settings.openai_base_url,
        },
        "storage": {"dbPath": "memory://sya-task-tree"},
        "decompose": {
            "maxSubtasks": 8,
            "defaultEstimateMinutes": 30,
            "includeBreaks": False,
            "breakDurationMinutes": 5,
        },
        "planning": {
            "completionLowThreshold": settings.completion_low_threshold,
            "completionHighThreshold": settings.completion_high_threshold,
            "evaluationLeafBatchSize": settings.evaluation_leaf_batch_size,
            "metricsWindowSize": settings.metrics_window_size,
        },
    }


def _resolve_task_id(path_value: str, payload: dict[str, Any] | None = None) -> str:
    if not path_value.startswith("{"):
        return path_value
    payload = payload or {}
    return str(payload.get("taskId") or payload.get("task_id") or path_value)


def _task_status(value: Any) -> TaskStatus | None:
    if value is None:
        return None
    normalized = str(value).strip().upper().replace("-", "_")
    aliases = {
        "PENDING": TaskStatus.PENDING,
        "ACTIVE": TaskStatus.IN_PROGRESS,
        "IN_PROGRESS": TaskStatus.IN_PROGRESS,
        "COMPLETED": TaskStatus.DONE,
        "COMPLETE": TaskStatus.DONE,
        "DONE": TaskStatus.DONE,
        "CANCELLED": TaskStatus.SKIPPED,
        "CANCELED": TaskStatus.SKIPPED,
        "BLOCKED": TaskStatus.BLOCKED,
        "SKIPPED": TaskStatus.SKIPPED,
        "UPCOMING": TaskStatus.PENDING,
    }
    return aliases.get(normalized)


def attach_sya_routes(app: FastAPI) -> None:
    """Register `/api/scheduler/*` on the FocusFlow FastAPI app."""

    from app.main import (
        InitTaskRequest,
        UpdateTaskStatusRequest,
        get_container,
        publish_init_task,
        publish_status_update,
    )

    @app.get("/manifest")
    async def manifest() -> dict[str, Any]:
        return FUNCTION_MANIFEST

    @app.post("/api/scheduler/decompose", response_model=FunctionResponse)
    async def scheduler_decompose(
        body: DecomposeRequest,
        container=Depends(get_container),
    ) -> FunctionResponse:
        ack = await publish_init_task(
            InitTaskRequest(goal=body.input, persona="balanced"),
            container,
            source="scheduler_api",
        )
        await container.event_bus.join()
        tree = await container.memory_store.get_task_tree_snapshot()
        tasks = [_node_to_task(node) for node in (tree.iter_leaves() if tree else [])]
        return function_ok(
            {
                "tasks": tasks,
                "timeline": _timeline_for_tree(tree),
                "eventId": ack.event_id,
            }
        )

    @app.get("/api/scheduler/tasks", response_model=FunctionResponse)
    async def scheduler_list_tasks(
        status: str | None = None,
        container=Depends(get_container),
    ) -> FunctionResponse:
        tree = await container.memory_store.get_task_tree_snapshot()
        tasks = [_node_to_task(node) for node in (tree.iter_nodes() if tree else [])]
        if tree is not None:
            tasks = [task for task in tasks if task["id"] != tree.task_id]
        if status:
            wanted = {
                "in_progress": "active",
                "active": "active",
                "completed": "completed",
                "pending": "pending",
            }.get(status, status)
            tasks = [task for task in tasks if task["status"] == wanted]
        return function_ok(tasks)

    @app.get("/api/scheduler/tasks/{taskId}", response_model=FunctionResponse)
    async def scheduler_get_task(
        taskId: str,
        request: Request,
        container=Depends(get_container),
    ) -> FunctionResponse:
        task_id = _resolve_task_id(taskId, dict(request.query_params))
        tree = await container.memory_store.get_task_tree_snapshot()
        node = tree.find_node(task_id) if tree is not None else None
        if node is None:
            raise HTTPException(status_code=404, detail="Task not found")
        return function_ok(_node_to_task(node))

    @app.put("/api/scheduler/tasks/{taskId}", response_model=FunctionResponse)
    async def scheduler_update_task(
        taskId: str,
        body: dict[str, Any],
        container=Depends(get_container),
    ) -> FunctionResponse:
        task_id = _resolve_task_id(taskId, body)
        status = _task_status(body.get("status"))
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
            return _node_to_task(node)

        try:
            task = await container.memory_store.mutate_tree(mutator)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Task not found") from exc
        await container.event_bus.join()
        tree = await container.memory_store.get_task_tree_snapshot()
        node = tree.find_node(task_id) if tree is not None else None
        return function_ok(_node_to_task(node) if node is not None else task)

    @app.delete("/api/scheduler/tasks/{taskId}", response_model=FunctionResponse)
    async def scheduler_delete_task(
        taskId: str,
        body: dict[str, Any] | None = None,
        container=Depends(get_container),
    ) -> FunctionResponse:
        task_id = _resolve_task_id(taskId, body or {})

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

    @app.get("/api/scheduler/timeline", response_model=FunctionResponse)
    async def scheduler_timeline(container=Depends(get_container)) -> FunctionResponse:
        tree = await container.memory_store.get_task_tree_snapshot()
        return function_ok(_timeline_for_tree(tree))

    @app.post("/api/scheduler/tasks/reorder", response_model=FunctionResponse)
    async def scheduler_reorder_tasks(
        body: ReorderTasksRequest,
        container=Depends(get_container),
    ) -> FunctionResponse:
        order = {task_id: index for index, task_id in enumerate(body.task_ids)}

        def mutator(root: TaskNode) -> None:
            for node in root.iter_nodes():
                node.children.sort(key=lambda child: order.get(child.task_id, len(order)))

        await container.memory_store.mutate_tree(mutator)
        return function_ok(None)

    @app.get("/api/scheduler/stats", response_model=FunctionResponse)
    async def scheduler_stats(container=Depends(get_container)) -> FunctionResponse:
        tree = await container.memory_store.get_task_tree_snapshot()
        leaves = list(tree.iter_leaves()) if tree is not None else []
        completed = [leaf for leaf in leaves if leaf.status == TaskStatus.DONE]
        return function_ok(
            {
                "date": date.today().isoformat(),
                "completedCount": len(completed),
                "totalEstimateMinutes": sum(_minutes(leaf.estimated_time) for leaf in leaves),
                "actualMinutes": sum(_minutes(leaf.actual_time) for leaf in leaves if leaf.actual_time),
            }
        )

    @app.get("/api/scheduler/config", response_model=FunctionResponse)
    async def scheduler_get_config(container=Depends(get_container)) -> FunctionResponse:
        return function_ok(_scheduler_config(container.settings))

    @app.put("/api/scheduler/config", response_model=FunctionResponse)
    async def scheduler_update_config(
        body: dict[str, Any],
        container=Depends(get_container),
    ) -> FunctionResponse:
        config = _scheduler_config(container.settings)
        for key, value in body.items():
            if isinstance(value, dict) and isinstance(config.get(key), dict):
                config[key].update(value)
            else:
                config[key] = value
        return function_ok(config)

    @app.get("/api/scheduler/events")
    async def scheduler_events() -> StreamingResponse:
        async def stream() -> AsyncIterator[str]:
            yield 'event: ready\ndata: {"event":"ready","payload":{"functionId":"scheduler"}}\n\n'
            while True:
                await asyncio.sleep(15)
                yield ": keepalive\n\n"

        return StreamingResponse(stream(), media_type="text/event-stream")

    @app.get("/api/scheduler/actions", response_model=FunctionResponse)
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
                ],
            }
        )
