"""Deterministic shared calendar with work cycles, recovery and protected history."""
from __future__ import annotations

import math
import re
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

from app.core.memory_store import PlannedProject
from app.models.task_tree import TaskStatus
from app.services.timeline import clock, minutes

CYCLE_DEFAULTS = {'focusMinutes': 45, 'breakMinutes': 5, 'recoveryMinutes': 15, 'cyclesBeforeRecovery': 4}
CYCLE_BOUNDS = {'focusMinutes': (5, 180), 'breakMinutes': (0, 60), 'recoveryMinutes': (0, 120), 'cyclesBeforeRecovery': (1, 12)}
PROTECTED = {TaskStatus.DONE, TaskStatus.SKIPPED, TaskStatus.IN_PROGRESS}
ROUTINE_FIELDS = ('workStart', 'workEnd', 'timezone', 'rest', 'dailyGranularity', *CYCLE_DEFAULTS)
FOCUS_FIELDS = ('periodStart', 'periodEnd', 'hoursPerDay', 'lunchStart', 'lunchEnd', 'dinnerStart', 'dinnerEnd')


def clock_minutes(value: str) -> int:
    if not re.fullmatch(r'(?:[01]\d|2[0-3]):[0-5]\d|24:00', value):
        raise ValueError('Work times must be HH:MM (00:00 through 24:00).')
    hour, minute = value.split(':')
    return int(hour) * 60 + int(minute)


def iso_date(value: str) -> date:
    if not isinstance(value, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', value):
        raise ValueError('Dates must use YYYY-MM-DD.')
    return date.fromisoformat(value)


def _minute(value: Any) -> int:
    if type(value) is not int or not 0 <= value <= 1440:
        raise ValueError('Work and meal minutes must be integers within one day.')
    return value


def work_intervals(config: dict[str, Any]) -> list[tuple[int, int]]:
    """Nominal wall-clock availability after meals, before recovery breaks."""
    focus = config.get('focusflow') or {}
    if not isinstance(focus, dict):
        raise ValueError('Routine settings must be an object.')
    start = clock_minutes(str(config.get('workStart') or clock(_minute(focus.get('periodStart', 540)))))
    end = clock_minutes(str(config.get('workEnd') or clock(_minute(focus.get('periodEnd', 1080)))))
    if start >= end:
        raise ValueError('Work must start before it ends; overnight windows are not supported.')
    meals = []
    for prefix, defaults in (('lunch', (720, 840)), ('dinner', (1080, 1200))):
        begin = _minute(focus.get(prefix + 'Start', defaults[0]))
        finish = _minute(focus.get(prefix + 'End', defaults[1]))
        if begin >= finish:
            raise ValueError('Meal start must precede its end.')
        meals.append((begin, finish))
    if max(meals[0][0], meals[1][0]) < min(meals[0][1], meals[1][1]):
        raise ValueError('Lunch and dinner must not overlap.')
    intervals = [(start, end)]
    for begin, finish in meals:
        remaining = []
        for left, right in intervals:
            if finish <= left or begin >= right:
                remaining.append((left, right))
            else:
                if left < begin:
                    remaining.append((left, begin))
                if finish < right:
                    remaining.append((finish, right))
        intervals = remaining
    if not intervals:
        raise ValueError('No work time remains after meals.')
    if 'hoursPerDay' in focus:
        hours = float(focus['hoursPerDay'])
        if not math.isfinite(hours) or hours <= 0 or abs(hours * 60 - sum(b - a for a, b in intervals)) > .01:
            raise ValueError('Daily available hours must equal the work period after meals; recovery breaks are deducted separately.')
    return intervals


def cycle_settings(config: dict[str, Any]) -> dict[str, int]:
    """Old saved schedules keep zero breaks until a routine change is confirmed."""
    configured = any(key in config for key in CYCLE_DEFAULTS)
    legacy_focus = {'fine': 25, 'finer': 25, 'standard': 45, 'coarse': 90, 'coarser': 90}.get(config.get('dailyGranularity'), 45)
    defaults = CYCLE_DEFAULTS if configured else {**CYCLE_DEFAULTS, 'focusMinutes': legacy_focus, 'breakMinutes': 0, 'recoveryMinutes': 0}
    result = {}
    for key, (low, high) in CYCLE_BOUNDS.items():
        value = config.get(key, defaults[key])
        if type(value) is not int or not low <= value <= high:
            raise ValueError(f'{key} must be an integer between {low} and {high}.')
        result[key] = value
    return result


def validate_routine(config: dict[str, Any]) -> None:
    work_intervals(config)
    cycle_settings(config)
    ZoneInfo(str(config.get('timezone') or 'Asia/Shanghai'))
    if config.get('routineDate'):
        iso_date(config['routineDate'])
    if config.get('dailyGranularity', 'standard') not in {'fine', 'finer', 'standard', 'coarse', 'coarser'}:
        raise ValueError('Granularity must be finer, standard, or coarser.')


def routine_view(config: dict[str, Any]) -> dict[str, Any]:
    focus = config.get('focusflow') or {}
    return {
        'workStart': config.get('workStart', clock(focus.get('periodStart', 540))),
        'workEnd': config.get('workEnd', clock(focus.get('periodEnd', 1080))),
        'timezone': config.get('timezone', 'Asia/Shanghai'),
        'rest': config.get('rest'), 'date': config.get('routineDate'),
        'focusflow': focus,
        'routineCycleConfigured': any(key in config for key in CYCLE_DEFAULTS),
        'availableMinutesPerDay': sum(b - a for a, b in work_intervals(config)),
        **cycle_settings(config),
    }


def routine_snapshot(config: dict[str, Any]) -> dict[str, Any]:
    result = {key: config[key] for key in ROUTINE_FIELDS if key in config}
    result['focusflow'] = {key: config['focusflow'][key] for key in FOCUS_FIELDS if key in (config.get('focusflow') or {})}
    return result


def routine_on(config: dict[str, Any], day: date) -> dict[str, Any]:
    matches = [entry for entry in config.get('routineHistory', []) if entry['fromDate'] <= day.isoformat()]
    return max(matches, key=lambda entry: entry['fromDate'])['routine'] if matches else config


def with_routine_change(previous: dict[str, Any], proposed: dict[str, Any], effective: date) -> dict[str, Any]:
    baseline = previous.get('routineHistory') or [{'fromDate': '0001-01-01', 'routine': routine_snapshot(previous)}]
    history = [entry for entry in baseline if entry['fromDate'] < effective.isoformat()]
    history.append({'fromDate': effective.isoformat(), 'routine': routine_snapshot(proposed)})
    return {**proposed, 'routineDate': effective.isoformat(), 'routineHistory': history}


def _wall_instant(day: date, minute: int, zone: ZoneInfo) -> int:
    """Choose the first fold, advancing nonexistent spring-forward boundaries."""
    naive = datetime.combine(day, time()) + timedelta(minutes=minute)
    for _ in range(181):
        local = naive.replace(tzinfo=zone, fold=0)
        if local.astimezone(timezone.utc).astimezone(zone).replace(tzinfo=None) == naive:
            return int(local.timestamp() // 60)
        naive += timedelta(minutes=1)
    raise ValueError('Work boundary does not exist in the selected timezone.')


@dataclass
class DaySchedule:
    intervals: list[tuple[int, int]]
    reserved: list[tuple[int, int]]
    cursor: int
    zone: ZoneInfo
    cycle: dict[str, int]
    cycle_configured: bool
    used: int = 0
    cycles: int = 0

    def next_span(self) -> tuple[int, int] | None:
        for left, right in self.intervals:
            start = max(left, self.cursor)
            for reserved_start, reserved_end in self.reserved:
                if reserved_end <= start or reserved_start >= right:
                    continue
                if reserved_start <= start:
                    start = reserved_end
                else:
                    if start < min(right, reserved_start):
                        return start, min(right, reserved_start)
            if start < right:
                return start, right
        return None


def _slot(start: int, end: int, zone: ZoneInfo, **fields: Any) -> dict[str, Any]:
    begin = datetime.fromtimestamp(start * 60, zone)
    finish = datetime.fromtimestamp(end * 60, zone)
    return {'date': begin.date().isoformat(), 'start': begin.strftime('%H:%M'), 'end': finish.strftime('%H:%M'), 'startTime': begin.isoformat(), 'endTime': finish.isoformat(), **fields}


def build_slots(projects: list[PlannedProject], config: dict[str, Any], previous: list[dict[str, Any]] | None = None) -> list[dict[str, Any]]:
    zone = ZoneInfo(str(config.get('timezone') or 'Asia/Shanghai'))
    nodes = {n.task_id: n for p in projects for n in p.tree.iter_leaves()}
    protected = {key: n for key, n in nodes.items() if n.status in PROTECTED or (n.actual_time or 0) > 0}
    routine_date = iso_date(config['routineDate']) if config.get('routineDate') else None
    kept = []
    previous_ids = {s['taskId'] for s in previous or [] if s.get('taskId')}
    previous_totals = {key: sum(slot_minutes(s) for s in previous or [] if s.get('taskId') == key) for key in previous_ids}
    for slot in previous or []:
        task_id = slot.get('taskId')
        before_effective = routine_date is not None and datetime.fromisoformat(slot['endTime']) <= datetime.combine(routine_date, time(), zone)
        if task_id in protected and slot.get('kind', 'work') == 'work':
            node = protected[task_id]
            kept.append({**slot, 'kind': 'work', 'title': node.title, 'status': 'completed' if node.status == TaskStatus.DONE else 'cancelled' if node.status == TaskStatus.SKIPPED else 'active' if node.status == TaskStatus.IN_PROGRESS else 'upcoming'})
        elif slot.get('kind') in {'break', 'recovery'} and slot.get('afterTaskId') in protected:
            kept.append(slot.copy())
        elif before_effective and ((task_id in nodes and previous_totals[task_id] == minutes(nodes[task_id].estimated_time)) or (slot.get('kind') in {'break', 'recovery'} and slot.get('afterTaskId') in nodes)):
            kept.append({**slot, 'title': nodes[task_id].title} if task_id in nodes else slot.copy())
    kept_minutes: dict[str, int] = {}
    for slot in kept:
        if slot.get('taskId'):
            kept_minutes[slot['taskId']] = kept_minutes.get(slot['taskId'], 0) + slot_minutes(slot)
    reservations = sorted((int(datetime.fromisoformat(s['startTime']).timestamp() // 60), int(datetime.fromisoformat(s['endTime']).timestamp() // 60)) for s in kept)
    jobs = []
    for p_index, project in enumerate(projects):
        origin = project.voyage.started_at.astimezone(zone).date()
        leaves = list(project.tree.iter_leaves())
        deadline = origin + timedelta(days=project.voyage.deadline_days - 1) if project.voyage.deadline_days else None
        for index, leaf in enumerate(leaves):
            if kept_minutes.get(leaf.task_id, 0) >= minutes(leaf.estimated_time):
                continue
            preferred = origin
            if project.voyage.deadline_days:
                preferred += timedelta(days=min(project.voyage.deadline_days - 1, index * project.voyage.deadline_days // max(1, len(leaves))))
            if leaf.scheduled_date:
                preferred = iso_date(leaf.scheduled_date[:10])
            if routine_date and leaf.task_id not in protected and (leaf.task_id in previous_ids or set(leaf.source_task_ids) & previous_ids):
                preferred = max(preferred, routine_date)
            jobs.append((preferred, p_index, index, leaf, project, deadline))
    days: dict[date, DaySchedule] = {}
    slots = kept
    for preferred, _, _, leaf, project, deadline in sorted(jobs, key=lambda item: item[:3]):
        day, remaining = preferred, minutes(leaf.estimated_time) - kept_minutes.get(leaf.task_id, 0)
        task_day = None
        while remaining:
            if (day - preferred).days > 36600:
                raise ValueError('The available routine cannot fit this plan within 100 years.')
            if day not in days:
                settings = routine_on(config, day)
                day_zone = ZoneInfo(str(settings.get('timezone') or 'Asia/Shanghai'))
                periods = [(_wall_instant(day, a, day_zone), _wall_instant(day, b, day_zone)) for a, b in work_intervals(settings)]
                periods = [(a, b) for a, b in periods if a < b]
                days[day] = DaySchedule(periods, reservations, periods[0][0] if periods else 0, day_zone, cycle_settings(settings), any(key in settings for key in CYCLE_DEFAULTS))
            state = days[day]
            if task_day != day and not state.cycle_configured:
                # Legacy grain caps each task's chunks independently. Carry
                # work across tasks only after an explicit cycle is confirmed.
                state.used = state.cycles = 0
            task_day = day
            cycle = state.cycle
            span = state.next_span()
            if span is None:
                day += timedelta(days=1)
                continue
            start, end = span
            if start > state.cursor:
                # Meals, protected work and overnight gaps interrupt a new
                # continuous work cycle; never count them as worked minutes.
                state.used = 0
            duration = min(remaining, end - start, cycle['focusMinutes'] - state.used)
            finish = start + duration
            slots.append(_slot(start, finish, state.zone, kind='work', taskId=leaf.task_id, projectId=project.voyage.voyage_id, title=leaf.title,
                status='completed' if leaf.status == TaskStatus.DONE else 'cancelled' if leaf.status == TaskStatus.SKIPPED else 'active' if leaf.status == TaskStatus.IN_PROGRESS else 'upcoming', overDeadline=bool(deadline and day > deadline)))
            state.cursor = finish
            state.used += duration
            remaining -= duration
            if state.used >= cycle['focusMinutes']:
                state.used = 0
                state.cycles += 1
                recovery = state.cycles % cycle['cyclesBeforeRecovery'] == 0
                pause = cycle['recoveryMinutes'] if recovery else cycle['breakMinutes']
                if pause:
                    # A meal or protected block supplies the remaining pause;
                    # do not count unavailable minutes twice as recovery.
                    stop = min(finish + pause, end)
                    following = [a for a, b in state.reserved if b > finish and a < stop]
                    if following:
                        stop = min(stop, max(finish, min(following)))
                    if stop > finish:
                        slots.append(_slot(finish, stop, state.zone, kind='recovery' if recovery else 'break', afterTaskId=leaf.task_id, projectId=project.voyage.voyage_id, title='Recovery break' if recovery else 'Short break', status='upcoming'))
                        state.cursor = stop
    return sorted(slots, key=lambda item: (datetime.fromisoformat(item['startTime']).timestamp(), item.get('taskId', '')))


def slot_minutes(slot: dict[str, Any]) -> int:
    return int(round((datetime.fromisoformat(slot['endTime']).timestamp() - datetime.fromisoformat(slot['startTime']).timestamp()) / 60))


def calendar_changes(before: list[dict[str, Any]], after: list[dict[str, Any]], config: dict[str, Any]) -> dict[str, Any]:
    def grouped(slots):
        result = {}
        for slot in slots:
            if slot.get('kind', 'work') == 'work':
                result.setdefault(slot['taskId'], []).append((slot['startTime'], slot['endTime']))
        return result
    old, new = grouped(before), grouped(after)
    moved = [task_id for task_id in set(old) | set(new) if old.get(task_id) != new.get(task_id)]
    return {'changed': bool(moved) or before != after, 'movedCount': len(moved), 'movedTaskIds': moved,
        'overflowCount': len({s['taskId'] for s in after if s.get('overDeadline') and s.get('taskId')}),
        'workMinutes': sum(slot_minutes(s) for s in after if s.get('kind', 'work') == 'work'),
        'breakMinutes': sum(slot_minutes(s) for s in after if s.get('kind') in {'break', 'recovery'}),
        'availableMinutesPerDay': sum(b-a for a,b in work_intervals(config))}


def window(slots: list[dict[str, Any]], query: dict[str, str], config: dict[str, Any]) -> dict[str, Any]:
    zone_name = query.get('timezone') or config.get('timezone') or 'Asia/Shanghai'
    zone = ZoneInfo(zone_name)
    view = query.get('view') or 'day'
    if view not in {'day', 'week', 'month'}:
        raise ValueError('View must be day, week, or month.')
    explicit = any(query.get(key) for key in ('from', 'to', 'view'))
    start = iso_date(query['from']) if query.get('from') else datetime.now(zone).date()
    end = iso_date(query['to']) if query.get('to') else start
    if not query.get('to'):
        if view == 'week':
            end = start + timedelta(days=6)
        elif view == 'month':
            start = start.replace(day=1)
            end = (start.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
    if end < start:
        raise ValueError('Timeline end must not precede its start.')
    events, breaks = [], []
    for slot in slots:
        begin = datetime.fromisoformat(slot['startTime']).astimezone(zone)
        finish = datetime.fromisoformat(slot['endTime']).astimezone(zone)
        if explicit and not start <= begin.date() <= end:
            continue
        value = {**slot, 'date': begin.date().isoformat(), 'start': begin.strftime('%H:%M'), 'end': finish.strftime('%H:%M'), 'startTime': begin.isoformat(), 'endTime': finish.isoformat(), 'time': f'{begin:%H:%M} - {finish:%H:%M}'}
        (events if slot.get('kind', 'work') == 'work' else breaks).append(value)
    return {'date': start.isoformat(), 'view': view, 'timezone': zone_name, 'events': events, 'breaks': breaks}
