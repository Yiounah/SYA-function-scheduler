"""Explainable duration-based edits; never claim to invent semantic subtasks."""
from __future__ import annotations

import math
import re
from typing import Any
from uuid import uuid4

from app.models.task_tree import TaskNode, TaskStatus
from app.services.timeline import minutes

TARGETS = {'finer': 25, 'standard': 45, 'coarser': 90}


def adjustable(node: TaskNode) -> bool:
    return node.status in {TaskStatus.PENDING, TaskStatus.BLOCKED} and not (node.actual_time or 0)


def target_minutes(level: str, supplied: int | None) -> int:
    if level == 'custom':
        if type(supplied) is not int or not 5 <= supplied <= 120:
            raise ValueError('Custom targetMinutes must be an integer between 5 and 120.')
        return supplied
    if level not in TARGETS:
        raise ValueError('Choose finer, standard, coarser, or custom.')
    if supplied is not None and (type(supplied) is not int or supplied != TARGETS[level]):
        raise ValueError(f'{level} is fixed at {TARGETS[level]} minutes. Choose custom for another duration.')
    return TARGETS[level]


def _sources(node: TaskNode) -> list[str]:
    return node.source_task_ids or [node.task_id]


def _base_title(title: str) -> str:
    return re.sub(r' · Part \d+/\d+$', '', title)


def _compatible(left: TaskNode, right: TaskNode) -> bool:
    return (left.status, left.scheduled_date, left.deadline) == (right.status, right.scheduled_date, right.deadline)


def _split(node: TaskNode, target: int) -> list[TaskNode]:
    if node.estimated_time * 60 <= target + 1e-8:
        return [node]
    total = minutes(node.estimated_time)
    count = max(2, math.ceil(node.estimated_time * 60 / target))
    whole, extra = divmod(total, count)
    pieces, used_hours = [], 0.0
    title = _base_title(node.title)
    for index in range(count):
        piece = node.model_copy(deep=True)
        if index:
            piece.task_id = uuid4().hex
        piece.estimated_time = (whole + (index < extra)) / 60 if index < count - 1 else node.estimated_time - used_hours
        used_hours += piece.estimated_time
        piece.title = f'{title} · Part {index + 1}/{count}'
        piece.source_task_ids = list(_sources(node))
        # The draft explains this mechanical edit once. Preserve the user's
        # instructions rather than repeatedly appending a generated disclaimer.
        pieces.append(piece)
    return pieces


def _merge(group: list[TaskNode]) -> TaskNode:
    first = group[0].model_copy(deep=True)
    first.estimated_time = sum(n.estimated_time for n in group)
    first.title = ' + '.join(dict.fromkeys(_base_title(n.title) for n in group))
    first.description = '\n'.join(dict.fromkeys(n.description for n in group if n.description))
    first.source_task_ids = list(dict.fromkeys(source for n in group for source in _sources(n)))
    return first


def _rewrite(run: list[TaskNode], level: str, target: int) -> list[TaskNode]:
    pieces = [piece for node in run for piece in (_split(node, target) if level != 'coarser' else [node])]
    if level == 'finer':
        return pieces
    result, group = [], []
    for piece in pieces:
        if group and (not _compatible(group[-1], piece) or sum(n.estimated_time for n in group) + piece.estimated_time > target / 60 + 1e-8):
            result.append(_merge(group) if len(group) > 1 else group[0])
            group = []
        group.append(piece)
    if group:
        result.append(_merge(group) if len(group) > 1 else group[0])
    return result


def adjust(root: TaskNode, task_id: str, level: str, target: int) -> dict[str, Any]:
    """Modify a copied tree and return a whole-project before/after summary."""
    before = list(root.iter_leaves())
    before_data = {n.task_id: n.model_dump() for n in before}
    chosen = root.find_node(task_id)
    selected = {n.task_id for n in chosen.iter_leaves() if adjustable(n)} if chosen else set()
    # A longer custom leaf target reuses the existing adjacent-sibling merge
    # scope, never another parent, an executed item, or a remote project.
    if chosen and chosen.is_leaf and chosen.parent_id and (level == 'coarser' or level == 'custom' and chosen.estimated_time * 60 < target):
        parent = root.find_node(chosen.parent_id)
        siblings = parent.children
        index = next(i for i, n in enumerate(siblings) if n.task_id == chosen.task_id)
        used = chosen.estimated_time * 60
        for sequence in (range(index + 1, len(siblings)), range(index - 1, -1, -1)):
            for i in sequence:
                neighbour = siblings[i]
                if neighbour.children or not adjustable(neighbour) or not _compatible(chosen, neighbour) or used + neighbour.estimated_time * 60 > target + 1e-8:
                    break
                selected.add(neighbour.task_id)
                used += neighbour.estimated_time * 60
    changes = []
    affected = set()
    for parent in list(root.iter_nodes()):
        if not parent.children or any(n.children for n in parent.children):
            continue
        result, run = [], []
        def flush():
            if not run:
                return
            rewritten = _rewrite(run, level, target)
            if [n.model_dump() for n in run] != [n.model_dump() for n in rewritten]:
                rewritten_data = {n.task_id: n.model_dump() for n in rewritten}
                affected.update(n.task_id for n in run if rewritten_data.get(n.task_id) != n.model_dump())
                changes.append({'sourceTaskIds': list(dict.fromkeys(source for n in run for source in _sources(n))), 'beforeTitles': [n.title for n in run], 'afterTitles': [n.title for n in rewritten], 'beforeMinutes': round(sum(n.estimated_time for n in run) * 60, 6), 'afterMinutes': round(sum(n.estimated_time for n in rewritten) * 60, 6)})
            result.extend(rewritten)
            run.clear()
        for child in parent.children:
            if child.task_id in selected:
                run.append(child)
            else:
                flush()
                result.append(child)
        flush()
        parent.children = result
    after = list(root.iter_leaves())
    preserved = sum(n.task_id in before_data and n.model_dump() == before_data[n.task_id] for n in after)
    return {'scope': 'project', 'scopeTaskId': task_id, 'changed': bool(changes), 'beforeCount': len(before), 'afterCount': len(after), 'beforeMinutes': round(sum(n.estimated_time for n in before) * 60, 6), 'afterMinutes': round(sum(n.estimated_time for n in after) * 60, 6), 'preservedCount': preserved, 'affectedCount': len(affected), 'targetMinutes': target, 'changes': changes}
