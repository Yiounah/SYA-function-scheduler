"""Draft, confirm, and persist plans for the host bridge.

Preview and granularity suggestions stay in memory until an explicit confirm
or commit. Host-owned storage is touched only by those writes and by config
updates. Reads never create the file.
"""

from __future__ import annotations

import asyncio
import copy
import json
import math
import os
from collections import deque
from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4
from zoneinfo import ZoneInfo

from fastapi.responses import JSONResponse

from app.agents.voyage.engine import AppContainer
from app.core.llm.gateway import PlanningModelError
from app.core.memory_store import PlannedProject
from app.models.persona import resolve_persona
from app.models.task_tree import TaskNode, TaskStatus
from app.models.voyage import Voyage, VoyagePhase
from app.services.timeline import clock, minutes, scheduler_config
from app.services.calendar import CYCLE_DEFAULTS, build_slots, calendar_changes, clock_minutes, iso_date, routine_on, routine_snapshot, routine_view, validate_routine, window, with_routine_change, work_intervals
from app.services.granularity import adjust, adjustable, target_minutes

MIN_LEAF_HOURS = 1 / 60
MAX_LEAF_HOURS = 24


class ConcurrentPlannerWrite(OSError):
    """Another scheduler process committed a newer shared planner revision."""


@contextmanager
def _file_lock(path: Path):
    with path.open("a+b") as lock:
        if os.name == "nt":
            import msvcrt
            lock.seek(0)
            if not lock.read(1):
                lock.write(b"0")
                lock.flush()
            lock.seek(0)
            msvcrt.locking(lock.fileno(), msvcrt.LK_LOCK, 1)
            try:
                yield
            finally:
                lock.seek(0)
                msvcrt.locking(lock.fileno(), msvcrt.LK_UNLCK, 1)
        else:
            import fcntl
            fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
            try:
                yield
            finally:
                fcntl.flock(lock.fileno(), fcntl.LOCK_UN)


class PlannerDesk:
    """In-process drafts plus the host-owned planner file."""

    def __init__(self) -> None:
        self.revision = 0
        self.overrides: dict[str, Any] = {}
        self.drafts: dict[str, dict[str, Any]] = {}
        self.commits: dict[str, dict[str, Any]] = {}
        self.lock = asyncio.Lock()
        self.events: deque[dict[str, Any]] = deque(maxlen=2000)
        self.subscribers: set[asyncio.Queue] = set()
        self.slots: list[dict[str, Any]] = []
        self.disk_revision = 0
        self.last_save_conflict = False

    def storage_path(self) -> Path | None:
        directory = os.environ.get("SYA_SCHEDULER_DATA_DIR")
        if not directory:
            return None
        return Path(directory) / "planner.json"

    def load(self) -> dict[str, Any] | None:
        path = self.storage_path()
        if path is None or not path.is_file():
            return None
        return json.loads(path.read_text(encoding="utf-8"))

    def save(self, projects: list[dict[str, Any]]) -> None:
        calendar_projects = [PlannedProject(voyage_from_stored(p["voyage"]), node_from_stored(p["tree"])) for p in projects]
        slots = build_slots(calendar_projects, self.overrides, self.slots)
        path = self.storage_path()
        if path is None:
            self.slots = slots
            return
        path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "revision": self.revision,
            "projects": projects,
            "config": self.overrides,
            "commits": self.commits,
            "events": list(self.events),
            "slots": slots,
        }
        with _file_lock(path.with_suffix(".lock")):
            disk_revision = int(json.loads(path.read_text(encoding="utf-8")).get("revision", 0)) if path.exists() else 0
            if disk_revision != self.disk_revision:
                raise ConcurrentPlannerWrite("A newer shared planner revision exists; reload before saving.")
            temporary = path.with_name(f".planner-{uuid4().hex}.tmp")
            try:
                with temporary.open("w", encoding="utf-8") as stream:
                    json.dump(payload, stream, ensure_ascii=False, allow_nan=False)
                    stream.flush()
                    os.fsync(stream.fileno())
                temporary.replace(path)
                self.slots = slots
                self.disk_revision = self.revision
            finally:
                temporary.unlink(missing_ok=True)

    def emit(self, name: str, **payload: Any) -> dict[str, Any]:
        event = {"event": name, "payload": payload, "id": uuid4().hex, "timestamp": datetime.now(timezone.utc).isoformat()}
        self.events.append(event)
        self.broadcast(event)
        return event

    def broadcast(self, event: dict[str, Any]) -> None:
        for subscriber in tuple(self.subscribers):
            if subscriber.full():
                subscriber.get_nowait()
            subscriber.put_nowait(event)


def failure(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"ok": False, "error": {"code": code, "message": message}})


def _parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def node_from_stored(data: dict[str, Any], parent_id: str | None = None) -> TaskNode:
    children = [node_from_stored(child, data["task_id"]) for child in data.get("children") or []]
    return TaskNode(
        task_id=data["task_id"],
        parent_id=parent_id,
        title=data["title"],
        description=data.get("description") or "",
        status=TaskStatus(data.get("status") or TaskStatus.PENDING),
        estimated_time=float(data.get("estimated_time", 1)),
        actual_time=data.get("actual_time"),
        deadline=data.get("deadline"),
        scheduled_date=data.get("scheduled_date"),
        source_task_ids=data.get("source_task_ids") or data.get("sourceTaskIds") or [],
        children=children,
    )


def voyage_from_stored(data: dict[str, Any]) -> Voyage:
    return Voyage(
        voyage_id=data["voyage_id"],
        goal=data["goal"],
        persona=data["persona"],
        deadline_days=data.get("deadline_days"),
        phase=VoyagePhase(data.get("phase") or VoyagePhase.PLANNING),
        human_gate_reason=data.get("human_gate_reason"),
        started_at=_parse_time(data["started_at"]),
        updated_at=_parse_time(data["updated_at"]),
        generation_mode=data.get("generation_mode", "unknown"),
    )


def _ids(node: TaskNode) -> list[str]:
    return [item.task_id for item in node.iter_nodes()]


def _depth(node: TaskNode) -> int:
    if not node.children:
        return 0
    return 1 + max(_depth(child) for child in node.children)


def validate_tree(payload: dict[str, Any]) -> TaskNode | JSONResponse:
    try:
        root = node_from_stored(payload)
    except Exception:
        return failure(422, "INVALID_TREE", "Plan tree is not a valid task hierarchy.")
    found = _ids(root)
    if len(found) != len(set(found)):
        return failure(409, "DUPLICATE_TASK", "Plan tree reuses a task id.")
    if not list(root.iter_leaves()):
        return failure(422, "INVALID_TREE", "Plan tree has no checklist items.")
    for leaf in root.iter_leaves():
        if not math.isfinite(leaf.estimated_time) or not (MIN_LEAF_HOURS <= leaf.estimated_time <= MAX_LEAF_HOURS):
            return failure(422, "INVALID_TREE", "Each checklist item must be between 1 and 1440 minutes.")
        if not leaf.title.strip():
            return failure(422, "INVALID_TREE", "Checklist items need a title.")
    for node in root.iter_nodes():
        if not node.task_id.strip() or not node.title.strip() or not math.isfinite(node.estimated_time):
            return failure(422, "INVALID_TREE", "Tasks need nonempty IDs, titles and finite durations.")
        for value in (node.deadline, node.scheduled_date):
            if value:
                try:
                    date.fromisoformat(value[:10])
                except ValueError:
                    return failure(422, "INVALID_TREE", "Task dates must use ISO 8601.")
    return root


def public_tree(root: TaskNode, project_id: str | None = None, depth: int = 0) -> dict[str, Any]:
    payload = root.model_dump(mode="json")
    payload.update({"parentId": root.parent_id, "nodeType": ("project", "stage", "task", "checklist")[min(depth, 3)], "sourceTaskIds": root.source_task_ids or [root.task_id]})
    if project_id:
        payload["projectId"] = project_id
    payload["children"] = [public_tree(child, project_id, depth + 1) for child in root.children]
    return payload


def draft_payload(desk: PlannerDesk, draft_id: str, root: TaskNode | None, warnings: list[str]) -> dict[str, Any]:
    draft = desk.drafts[draft_id]
    return {
        "draftId": draft_id,
        "baseRevision": draft["baseRevision"],
        "revision": draft["baseRevision"],
        "kind": draft["kind"],
        "projectId": draft.get("projectId"),
        "tree": public_tree(root, draft.get("projectId")) if root else None,
        "proposedSlots": draft.get("slots", []),
        "generationMode": draft.get("generationMode", "deterministic"),
        "expiresAt": draft["expiresAt"],
        "canCommit": draft.get("canCommit", True),
        "changeSummary": draft.get("changeSummary"),
        "warnings": warnings,
        "events": [{"name": "schedule.plan_generated", "draftId": draft_id}],
    }


async def restore_desk(container: AppContainer, desk: PlannerDesk) -> None:
    raw = desk.load()
    if not raw:
        return
    desk.revision = int(raw.get("revision") or 0)
    desk.disk_revision = desk.revision
    desk.overrides = dict(raw.get("config") or {})
    desk.commits = dict(raw.get("commits") or {})
    desk.events = deque(raw.get("events") or [], maxlen=2000)
    desk.slots = list(raw.get("slots") or [])
    projects: list[PlannedProject] = []
    for item in raw.get("projects") or []:
        projects.append(
            PlannedProject(
                voyage=voyage_from_stored(item["voyage"]),
                tree=node_from_stored(item["tree"]),
            )
        )
    await container.memory_store.restore_projects(projects)


async def refresh_desk(container: AppContainer) -> None:
    desk = getattr(container, "planner_desk", None)
    if desk is None:
        return
    async with desk.lock:
        raw = desk.load()
        if raw and int(raw.get("revision", 0)) != desk.disk_revision:
            await restore_desk(container, desk)


async def persist(container: AppContainer, desk: PlannerDesk) -> None:
    projects = await container.memory_store.list_projects()
    desk.save(
        [
            {
                "voyage": project.voyage.model_dump(mode="json"),
                "tree": project.tree.model_dump(mode="json"),
            }
            for project in projects
        ]
    )


def config_view(container: AppContainer, desk: PlannerDesk) -> dict[str, Any]:
    config = scheduler_config(container.settings)
    config["workStart"] = "09:00"
    config["workEnd"] = "18:00"
    config["dailyGranularity"] = "standard"
    for key, value in desk.overrides.items():
        if isinstance(value, dict) and isinstance(config.get(key), dict):
            config[key].update(value)
        else:
            config[key] = value
    config["llm"]["apiKey"] = ""
    config.update({key: value for key, value in routine_view(desk.overrides).items() if key in {*CYCLE_DEFAULTS, 'routineCycleConfigured', 'availableMinutesPerDay'}})
    return config


def _project(projects: list[PlannedProject], identifier: str | None) -> PlannedProject | None:
    return next((p for p in projects if identifier in {p.voyage.voyage_id, p.tree.task_id}), None)


def _preserves_execution(old: TaskNode, new: TaskNode) -> bool:
    for node in old.iter_nodes():
        if node.status in {TaskStatus.DONE, TaskStatus.SKIPPED, TaskStatus.IN_PROGRESS} or (node.actual_time or 0) > 0:
            replacement = new.find_node(node.task_id)
            if replacement is None or replacement.model_dump() != node.model_dump():
                return False
    return True


def _merge_config(current: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
    merged = copy.deepcopy(current)
    for key, value in patch.items():
        if value is None:
            continue
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key].update(value)
        else:
            merged[key] = value
    return merged


def normalize_routine(current: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
    """Keep host clock strings and standalone minute fields one routine.

    A simple host time edit derives daily hours from the saved meals. A full
    standalone form supplies hours explicitly and still must pass validation.
    Metadata-only patches never change the routine.
    """
    merged = _merge_config(current, patch)
    supplied_focus = patch.get("focusflow") or {}
    routine_keys = {"periodStart", "periodEnd", "hoursPerDay", "lunchStart", "lunchEnd", "dinnerStart", "dinnerEnd"}
    if not any(patch.get(key) is not None for key in ("workStart", "workEnd")) and not routine_keys.intersection(supplied_focus):
        return merged
    focus = dict(merged.get("focusflow") or {})
    for clock_key, minute_key, default in (("workStart", "periodStart", 540), ("workEnd", "periodEnd", 1080)):
        if patch.get(clock_key) is not None:
            minute = clock_minutes(str(patch[clock_key]))
            if minute_key in supplied_focus and supplied_focus[minute_key] != minute:
                raise ValueError("Clock and minute representations of the work period disagree.")
        elif minute_key in supplied_focus:
            minute = supplied_focus[minute_key]
            if type(minute) is not int or not 0 <= minute <= 1440:
                raise ValueError("Work period minutes must be integers within one day.")
        else:
            minute = clock_minutes(str(merged[clock_key])) if merged.get(clock_key) else int(focus.get(minute_key, default))
        merged[clock_key] = clock(minute)
        focus[minute_key] = minute
    merged["focusflow"] = focus
    if "hoursPerDay" not in supplied_focus:
        without_hours = copy.deepcopy(merged)
        without_hours["focusflow"].pop("hoursPerDay", None)
        focus["hoursPerDay"] = sum(end - start for start, end in work_intervals(without_hours)) / 60
    validate_routine(merged)
    return merged


def _new_draft(desk: PlannerDesk, *, root: TaskNode | None, projects: list[PlannedProject], kind: str, revision: int, project: PlannedProject | None = None, config: dict[str, Any] | None = None, **metadata: Any) -> tuple[str, dict[str, Any]]:
    now = datetime.now(timezone.utc)
    desk.drafts = {key: value for key, value in desk.drafts.items() if _parse_time(value["expiresAt"]) > now}
    if len(desk.drafts) >= 128:
        desk.drafts.pop(next(iter(desk.drafts)))
    draft_id = uuid4().hex
    proposed = list(projects)
    if project is not None and root is not None:
        replacement = PlannedProject(project.voyage, root)
        proposed = [replacement if p.voyage.voyage_id == project.voyage.voyage_id else p for p in proposed]
        if not any(p.voyage.voyage_id == project.voyage.voyage_id for p in projects):
            proposed.append(replacement)
    draft = {
        "tree": root.model_dump(mode="json") if root else None,
        "baseRevision": revision,
        "kind": kind,
        "projectId": project.voyage.voyage_id if project else None,
        "voyage": project.voyage.model_dump(mode="json") if project else None,
        "expiresAt": (now + timedelta(minutes=30)).isoformat(),
        "config": config,
        "slots": build_slots(proposed, config if config is not None else desk.overrides, desk.slots),
        **metadata,
    }
    desk.drafts[draft_id] = draft
    return draft_id, draft


async def preview_plan(container: AppContainer, desk: PlannerDesk, body: dict[str, Any]) -> dict[str, Any] | JSONResponse:
    goal = str(body.get("goal") or body.get("input") or (body.get("tree") or {}).get("title") or "").strip()
    if not goal:
        return failure(422, "INVALID_INPUT", "A goal is required.")
    projects = await container.memory_store.list_projects()
    base_revision = desk.revision
    owner = _project(projects, body.get("projectId"))
    if body.get("projectId") and owner is None:
        return failure(404, "PROJECT_NOT_FOUND", "Choose an existing project to revise.")
    if body.get("expectedRevision") is not None and body["expectedRevision"] != base_revision:
        return failure(409, "STALE_DRAFT", "The project changed. Reload it before editing.")
    persona = resolve_persona(body.get("persona") or "balanced")
    try:
        config = normalize_routine(desk.overrides, body.get("availability") or {})
        config = _merge_config(config, {"timezone": body.get("timezone")})
        validate_routine(config)
    except (ValueError, TypeError, KeyError):
        return failure(422, "INVALID_ROUTINE", "Availability or timezone is invalid.")
    mode = "manual" if body.get("tree") is not None else "model"
    if body.get("tree") is not None:
        tree_json = body["tree"]
    else:
        sample = bool(body.get("allowSample"))
        mode = "sample" if sample else "model"
        try:
            tree_json = _sample_tree(goal) if sample else await container.llm_gateway.generate_task_tree(
                goal=goal, persona=persona, strategy=None,
                context={"cognitive_phase": "intent_capture", "goal": goal, "projectId": body.get("projectId"), "granularity": body.get("granularity"), "availability": config, "timezone": config.get("timezone", "Asia/Shanghai"), "deadline_days": body.get("deadline_days"), "shape": "goal -> stage -> task -> leaf", "existing_tree": owner.tree.model_dump(mode="json") if owner else None},
                response_schema=_plan_schema(),
                allow_mock=False,
            )
        except PlanningModelError as exc:
            return failure(422, exc.code, str(exc))
        except (RuntimeError, ValueError):
            return failure(422, "MODEL_UNAVAILABLE", "The planning model did not return a plan. Retry or explicitly choose the sample plan.")
    validated = validate_tree(tree_json)
    if isinstance(validated, JSONResponse):
        return validated
    if _depth(validated) != 3 or any(not n.children and depth != 3 for n, depth in _walk_depth(validated)):
        return failure(422, "INVALID_TREE", "Every checklist item must belong to project → stage → task → checklist.")
    if mode == "model" and owner is None and any(n.status != TaskStatus.PENDING for n in validated.iter_nodes()):
        return failure(422, "INVALID_TREE", "A newly generated plan cannot invent execution progress.")
    if owner:
        if validated.task_id != owner.tree.task_id or not _preserves_execution(owner.tree, validated):
            return failure(409, "PROTECTED_TASK", "Started and finished tasks must keep their IDs, contents and progress.")
        project = PlannedProject(owner.voyage.model_copy(deep=True), validated)
        project.voyage.goal = goal
        project.voyage.updated_at = datetime.now(timezone.utc)
        if body.get("deadline_days") is not None:
            project.voyage.deadline_days = body["deadline_days"]
    else:
        foreign = {n.task_id for p in projects for n in p.tree.iter_nodes()}
        if set(_ids(validated)) & foreign:
            prefix = uuid4().hex[:8] + "-"
            for node in validated.iter_nodes():
                node.task_id = prefix + node.task_id
            validated = node_from_stored(validated.model_dump(mode="json"))
        project = PlannedProject(Voyage(goal=goal, persona=persona.persona_id, deadline_days=body.get("deadline_days"), generation_mode=mode), validated)
    warnings = ["Sample plan: generated locally without a live model."] if mode == "sample" else []
    draft_id, draft = _new_draft(desk, root=validated, projects=projects, project=project, kind="plan", revision=base_revision, generationMode=mode, config=config)
    if any(slot.get("overDeadline") for slot in draft["slots"]):
        warnings.append("Some work exceeds the deadline and is shown on later days.")
    desk.emit("schedule.plan_generated", draftId=draft_id, generationMode=mode, projectId=project.voyage.voyage_id)
    return draft_payload(desk, draft_id, validated, warnings)


def _sample_tree(goal: str) -> dict[str, Any]:
    """Explicit demonstration content, never a fallback after provider failure."""
    def node(title: str, children: list[dict[str, Any]] | None = None) -> dict[str, Any]:
        return {"task_id": uuid4().hex, "title": title, "description": "Sample plan — adapt these example steps to your goal.", "estimated_time": .5, "children": children or []}
    return node(goal, [
        node("Clarify the goal", [node("Define the deliverable", [node("Write the expected outcome"), node("List success criteria")])]),
        node("Develop and test", [node("Produce a first version", [node("Prepare the first draft"), node("Check it against the criteria")])]),
        node("Review and deliver", [node("Finish the deliverable", [node("Address the remaining gaps"), node("Record the result and next step")])]),
    ])


def _plan_schema(depth: int = 0) -> dict[str, Any]:
    children = {"type": "array", "maxItems": 0} if depth == 3 else {"type": "array", "minItems": 1, "maxItems": 20, "items": _plan_schema(depth + 1)}
    return {"type": "object", "required": ["task_id", "title", "estimated_time", "children"], "properties": {"task_id": {"type": "string", "minLength": 1}, "title": {"type": "string", "minLength": 1}, "description": {"type": "string"}, "estimated_time": {"type": "number", "minimum": MIN_LEAF_HOURS, "maximum": MAX_LEAF_HOURS}, "status": {"type": "string", "enum": ["PENDING", "IN_PROGRESS", "DONE", "BLOCKED", "SKIPPED"]}, "children": children}}


def _walk_depth(root: TaskNode, depth: int = 0):
    yield root, depth
    for child in root.children:
        yield from _walk_depth(child, depth + 1)


async def _save_replacement(container: AppContainer, desk: PlannerDesk, projects: list[PlannedProject], *, preserve_active: bool = False) -> bool:
    """Write durable state before publishing it to readers; a failed write is inert."""
    desk.last_save_conflict = False
    try:
        desk.save([{"voyage": p.voyage.model_dump(mode="json"), "tree": p.tree.model_dump(mode="json")} for p in projects])
    except OSError as exc:
        desk.last_save_conflict = isinstance(exc, ConcurrentPlannerWrite)
        return False
    await container.memory_store.restore_projects(projects, preserve_active=preserve_active)
    return True


async def confirm_tree(container: AppContainer, desk: PlannerDesk, tree_payload: dict[str, Any]) -> dict[str, Any] | JSONResponse:
    """Compatibility import for a new tree. Existing plans require a revisioned draft."""
    validated = validate_tree(tree_payload)
    if isinstance(validated, JSONResponse):
        return validated
    async with desk.lock:
        projects = await container.memory_store.list_projects()
        if set(_ids(validated)) & {n.task_id for p in projects for n in p.tree.iter_nodes()}:
            return failure(409, "DUPLICATE_TASK", "Use preview and commit to revise an existing project.")
        voyage = Voyage(goal=validated.title, persona="balanced")
        projects.append(PlannedProject(voyage, validated))
        desk.revision += 1
        if not await _save_replacement(container, desk, projects):
            desk.revision -= 1
            return failure(409 if desk.last_save_conflict else 503, "STALE_DRAFT" if desk.last_save_conflict else "STORAGE_UNAVAILABLE", "The plan could not be saved. Reload before retrying; your current plan is unchanged.")
        desk.emit("task.updated", projectId=voyage.voyage_id, revision=desk.revision)
        return {"projectId": voyage.voyage_id, "revision": desk.revision, "tree": public_tree(validated, voyage.voyage_id), "events": [{"name": "schedule.plan_confirmed", "projectId": voyage.voyage_id}]}


async def commit_draft(container: AppContainer, desk: PlannerDesk, draft_id: str, body: dict[str, Any]) -> dict[str, Any] | JSONResponse:
    request_id = str(body.get("requestId") or "").strip()
    expected = body.get("expectedRevision")
    if not request_id or type(expected) is not int:
        return failure(422, "INVALID_COMMIT", "expectedRevision and a nonempty requestId are required.")
    async with desk.lock:
        prior = desk.commits.get(request_id)
        if prior:
            if prior.get("draftId") != draft_id or prior.get("baseRevision") != expected:
                return failure(409, "REQUEST_ID_REUSED", "This requestId belongs to another confirmation.")
            return prior
        draft = desk.drafts.get(draft_id)
        if draft is None or _parse_time(draft["expiresAt"]) <= datetime.now(timezone.utc):
            desk.drafts.pop(draft_id, None)
            return failure(409, "DRAFT_EXPIRED", "This draft expired or was cancelled. Generate a new preview.")
        if expected != draft["baseRevision"] or expected != desk.revision:
            return failure(409, "STALE_DRAFT", "Tasks or routine changed after this draft. Reload and preview again.")
        if not draft.get("canCommit", True):
            return failure(409, "NO_CHANGES", "This preview does not change any work. Choose another scope or target duration.")
        projects = await container.memory_store.list_projects()
        root = node_from_stored(draft["tree"]) if draft["tree"] else None
        project_id = draft.get("projectId")
        if root is not None and draft["kind"] != "routine":
            owner = _project(projects, project_id)
            if owner and not _preserves_execution(owner.tree, root):
                return failure(409, "PROTECTED_TASK", "Started and finished tasks cannot be overwritten.")
            foreign = {n.task_id for p in projects if p.voyage.voyage_id != project_id for n in p.tree.iter_nodes()}
            if set(_ids(root)) & foreign:
                return failure(409, "DUPLICATE_TASK", "This draft contains IDs from another project.")
            project = PlannedProject(voyage_from_stored(draft["voyage"]), root)
            projects = [project if p.voyage.voyage_id == project_id else p for p in projects]
            if owner is None:
                projects.append(project)
        old_config, old_events = desk.overrides, list(desk.events)
        if draft.get("config") is not None:
            desk.overrides = copy.deepcopy(draft["config"])
        if draft["kind"] == "granularity":
            # Both renderers display today's choice from this one atomic
            # confirmation; a second config request could race a newer plan.
            desk.overrides = copy.deepcopy(desk.overrides)
            day = datetime.now(ZoneInfo(str(desk.overrides.get("timezone") or "Asia/Shanghai"))).date().isoformat()
            level = {"finer": "fine", "standard": "steady", "coarser": "wide"}[draft["level"]]
            desk.overrides["todayGrain"] = {"date": day, "level": level, "targetMinutes": draft["targetMinutes"]}
            focusflow = desk.overrides.setdefault("focusflow", {})
            focusflow.setdefault("dayGrain", {})[day] = level
            focusflow["dayGrainDismissed"] = f"{day}|{level}"
        desk.revision += 1
        event = {"granularity": "schedule.granularity_applied", "routine": "schedule.routine_applied"}.get(draft["kind"], "schedule.plan_confirmed")
        mapping = {source: [n.task_id for n in root.iter_leaves() if source in (n.source_task_ids or [n.task_id])] for source in {source for n in root.iter_leaves() for source in (n.source_task_ids or [n.task_id])}} if root else {}
        result = {"draftId": draft_id, "baseRevision": expected, "projectId": project_id, "revision": desk.revision, "tree": public_tree(root, project_id) if root else None, "taskMapping": mapping, "events": [{"name": event, "draftId": draft_id, "requestId": request_id}]}
        desk.commits[request_id] = result
        # Retain enough retry keys for ordinary offline/restart recovery, bounded on disk.
        if len(desk.commits) > 1000:
            desk.commits.pop(next(iter(desk.commits)))
        confirmed_event = {"event": event, "id": uuid4().hex, "timestamp": datetime.now(timezone.utc).isoformat(), "payload": {"draftId": draft_id, "requestId": request_id, "projectId": project_id}}
        desk.events.append(confirmed_event)
        if not await _save_replacement(container, desk, projects):
            desk.overrides = old_config
            desk.revision -= 1
            desk.commits.pop(request_id, None)
            desk.events = deque(old_events, maxlen=2000)
            return failure(409 if desk.last_save_conflict else 503, "STALE_DRAFT" if desk.last_save_conflict else "STORAGE_UNAVAILABLE", "The plan could not be saved. Reload before retrying; your current plan is unchanged.")
        desk.drafts.pop(draft_id, None)
        desk.broadcast(confirmed_event)
        desk.emit("task.updated", projectId=project_id, revision=desk.revision, draftId=draft_id)
        desk.emit("timeline.changed", projectId=project_id, revision=desk.revision)
        return result


async def preview_granularity(container: AppContainer, desk: PlannerDesk, body: dict[str, Any]) -> dict[str, Any] | JSONResponse:
    task_id = str(body.get("taskId") or "")
    level = {"fine": "finer", "coarse": "coarser"}.get(str(body.get("level")), str(body.get("level") or "finer"))
    try:
        target_duration = target_minutes(level, body.get('targetMinutes'))
    except ValueError as exc:
        return failure(422, "INVALID_GRANULARITY", str(exc))
    projects = await container.memory_store.list_projects()
    owner = next((p for p in projects if p.tree.find_node(task_id)), None)
    if owner is None or body.get("projectId") and body["projectId"] not in {owner.voyage.voyage_id, owner.tree.task_id}:
        return failure(404, "TASK_NOT_FOUND", "Choose a saved task in this project before adjusting grain.")
    copied = owner.tree.model_copy(deep=True)
    target = copied.find_node(task_id)
    warnings = []
    adjustment_id = task_id
    if target.status == TaskStatus.IN_PROGRESS and target.parent_id:
        target = copied.find_node(target.parent_id)
        adjustment_id = target.task_id
        warnings.append("The running checklist item and its Focus session are preserved; only unstarted sibling steps are adjusted.")
    if not any(adjustable(n) for n in target.iter_leaves()):
        return failure(409, "NO_PENDING_TASKS", "Only unstarted, unfinished work can be adjusted.")
    summary = adjust(copied, adjustment_id, level, target_duration)
    warnings.append('Duration-based adjustment only; review each concrete next action before confirming. No model or semantic decomposition was used.')
    if not summary['changed']:
        warnings.append('Existing steps already fit this duration, or no adjacent unstarted steps can be combined. The plan will not be changed.')
    draft_id, draft = _new_draft(desk, root=copied, projects=projects, project=owner, kind="granularity", revision=desk.revision, taskId=task_id, level=level, targetMinutes=target_duration, reason=body.get("reason"), focusSessionId=body.get("focusSessionId"), changeSummary=summary, canCommit=summary['changed'])
    payload = draft_payload(desk, draft_id, copied, warnings)
    payload["events"] = [{"name": "schedule.granularity_requested", "taskId": task_id, "level": level, "draftId": draft_id}]
    payload["context"] = {key: draft.get(key) for key in ("taskId", "level", "targetMinutes", "reason", "focusSessionId")}
    desk.emit("schedule.granularity_requested", **payload["context"], draftId=draft_id)
    return payload


async def preview_routine(container: AppContainer, desk: PlannerDesk, body: dict[str, Any]) -> dict[str, Any] | JSONResponse:
    patch = {key: body[key] for key in ("workStart", "workEnd", "rest", "timezone", "focusflow", "dailyGranularity", *CYCLE_DEFAULTS) if body.get(key) is not None}
    for key, default in CYCLE_DEFAULTS.items():
        patch.setdefault(key, desk.overrides.get(key, default))
    try:
        zone = ZoneInfo(str(patch.get('timezone') or desk.overrides.get('timezone') or 'Asia/Shanghai'))
        effective = iso_date(body['date']) if body.get('date') else datetime.now(zone).date()
        config = normalize_routine(desk.overrides, patch)
        config = with_routine_change(desk.overrides, config, effective)
        validate_routine(config)
    except (ValueError, TypeError, KeyError) as exc:
        return failure(422, "INVALID_ROUTINE", str(exc))
    projects = await container.memory_store.list_projects()
    owner = _project(projects, body.get("projectId"))
    if body.get("projectId") and owner is None:
        return failure(404, "PROJECT_NOT_FOUND", "Choose an existing project.")
    # A routine is shared by every project, so disclose all affected work.
    before_slots = build_slots(projects, desk.overrides, desk.slots)
    draft_id, draft = _new_draft(desk, root=None, projects=projects, project=None, kind="routine", revision=desk.revision, config=config)
    summary = calendar_changes(before_slots, draft['slots'], config)
    affected = [{"taskId": n.task_id, "title": n.title, "projectId": p.voyage.voyage_id, "moved": n.task_id in summary['movedTaskIds']} for p in projects for n in p.tree.iter_leaves() if adjustable(n) and any(s.get('taskId') == n.task_id and datetime.fromisoformat(s['endTime']).astimezone(zone).date() >= effective for s in draft['slots'])]
    summary.update({'affectedCount': len(affected), 'preservedCount': sum(not adjustable(n) for p in projects for n in p.tree.iter_leaves())})
    # A routine can be meaningfully saved before any project exists.
    summary['changed'] = routine_view(desk.overrides) != routine_view(config) or desk.overrides.get('routineHistory') != config.get('routineHistory') or summary['changed']
    draft['changeSummary'] = summary
    draft['canCommit'] = summary['changed']
    warnings = [] if summary['movedCount'] else ['No unfinished tasks move; the confirmed routine will apply to future work.']
    if any(entry['fromDate'] > effective.isoformat() for entry in desk.overrides.get('routineHistory', [])):
        warnings.append('This confirmation replaces routine changes previously scheduled after the selected effective date.')
    if summary['overflowCount']:
        warnings.append(f"{summary['overflowCount']} task(s) extend past their deadline after allowing for work and recovery.")
    payload = draft_payload(desk, draft_id, None, warnings)
    payload.update({"beforeRoutine": routine_view(routine_on(desk.overrides, effective)), "suggestion": routine_view(config), "affectedTasks": affected})
    payload["events"] = [{"name": "schedule.routine_suggested", "draftId": draft_id}]
    desk.emit("schedule.routine_suggested", draftId=draft_id, affectedCount=len(affected))
    return payload


async def cancel_draft(desk: PlannerDesk, draft_id: str) -> dict[str, Any]:
    async with desk.lock:
        existed = desk.drafts.pop(draft_id, None) is not None
        return {"draftId": draft_id, "cancelled": existed}


async def update_config(container: AppContainer, desk: PlannerDesk, body: dict[str, Any]) -> dict[str, Any] | JSONResponse:
    async with desk.lock:
        previous = desk.overrides
        try:
            # History belongs to the scheduler. Old callers can still update
            # today's routine, but cannot inject or overwrite its audit map.
            patch = {key: value for key, value in body.items() if key not in {'routineHistory', 'routineDate'}}
            config = normalize_routine(previous, patch)
            if isinstance(config.get("llm"), dict):
                config["llm"].pop("apiKey", None)
            validate_routine(config)
            if previous.get('routineHistory') and routine_snapshot(previous) != routine_snapshot(config):
                effective = datetime.now(ZoneInfo(str(config.get('timezone') or 'Asia/Shanghai'))).date()
                config = with_routine_change(previous, config, effective)
        except (ValueError, TypeError, KeyError):
            return failure(422, "INVALID_ROUTINE", "Work, meals, daily hours, or timezone are inconsistent.")
        desk.overrides = config
        desk.revision += 1
        projects = await container.memory_store.list_projects()
        if not await _save_replacement(container, desk, projects, preserve_active=True):
            desk.overrides = previous
            desk.revision -= 1
            return failure(409 if desk.last_save_conflict else 503, "STALE_DRAFT" if desk.last_save_conflict else "STORAGE_UNAVAILABLE", "Configuration could not be saved. Reload before retrying.")
        desk.emit("timeline.changed", revision=desk.revision)
        return config_view(container, desk)


def timeline_window(root: TaskNode | None, query: dict[str, str], overrides: dict[str, Any]) -> dict[str, Any]:
    # Retained for imports; route callers use all saved project start timestamps.
    projects = [PlannedProject(Voyage(goal=root.title, persona="balanced"), root)] if root else []
    return window(build_slots(projects, overrides), query, overrides)
