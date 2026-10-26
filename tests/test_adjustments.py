"""Observable duration edits and real shared work/rest calendar behavior."""
from __future__ import annotations

import os
import tempfile
import unittest
from datetime import date, datetime
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient
from tests.test_planner_acceptance import application
from app.core.memory_store import PlannedProject
from app.models.task_tree import TaskNode, TaskStatus
from app.models.voyage import Voyage
from app.services.calendar import build_slots, calendar_changes, cycle_settings, slot_minutes, validate_routine, window, with_routine_change
from app.services.granularity import adjust, target_minutes


def tree(durations=(60,), prefix='p'):
    leaves = [TaskNode(task_id=f'{prefix}-{i}', title=f'Action {i}', description='User checkpoint', estimated_time=float(m / 60)) for i, m in enumerate(durations)]
    task = TaskNode(task_id=f'{prefix}-task', title='Task', children=leaves)
    return TaskNode(task_id=f'{prefix}-root', title='Project', children=[TaskNode(task_id=f'{prefix}-stage', title='Stage', children=[task])])


def project(root, start='2026-10-26', days=None, zone='Asia/Shanghai'):
    return PlannedProject(Voyage(voyage_id=root.task_id, goal=root.title, persona='balanced', started_at=datetime.fromisoformat(start).replace(tzinfo=ZoneInfo(zone)), deadline_days=days), root)


def work(slots):
    return [s for s in slots if s.get('kind', 'work') == 'work']


class GranularityTests(unittest.TestCase):
    def test_finer_preserves_duration_sources_and_execution_and_repeat_is_noop(self):
        root = tree((80, 10, 40, 35))
        root.find_node('p-2').status = TaskStatus.DONE
        root.find_node('p-3').actual_time = .1
        protected = {n.task_id: n.model_dump() for n in root.iter_leaves() if n.task_id in {'p-2', 'p-3'}}
        summary = adjust(root, root.task_id, 'finer', 20)
        self.assertEqual((summary['beforeCount'], summary['afterCount']), (4, 7))
        self.assertEqual(summary['beforeMinutes'], summary['afterMinutes'])
        self.assertEqual(summary['affectedCount'], 1)
        pieces = [n for n in root.iter_leaves() if 'p-0' in n.source_task_ids]
        self.assertEqual(len(pieces), 4)
        self.assertTrue(all(n.estimated_time * 60 <= 20 for n in pieces))
        self.assertTrue(all(n.parent_id == 'p-task' and n.description == 'User checkpoint' for n in pieces))
        self.assertEqual({key: root.find_node(key).model_dump() for key in protected}, protected)
        self.assertFalse(adjust(root, root.task_id, 'finer', 20)['changed'])

    def test_leaf_coarsening_merges_only_adjacent_compatible_siblings(self):
        root = tree((20, 20, 20, 20))
        root.find_node('p-2').status = TaskStatus.BLOCKED
        root.find_node('p-3').scheduled_date = '2026-10-28'
        summary = adjust(root, 'p-0', 'coarser', 60)
        self.assertEqual((summary['beforeCount'], summary['afterCount']), (4, 3))
        self.assertEqual(root.find_node('p-0').source_task_ids, ['p-0', 'p-1'])
        self.assertEqual(root.find_node('p-2').status, TaskStatus.BLOCKED)
        self.assertEqual(root.find_node('p-3').scheduled_date, '2026-10-28')
        self.assertFalse(adjust(root, 'p-2', 'coarser', 90)['changed'])
        self.assertFalse(adjust(root, root.task_id, 'coarser', 90)['changed'])
        for field in ('scheduled_date', 'deadline'):
            separate = tree((20, 20))
            setattr(separate.find_node('p-1'), field, '2026-11-01')
            self.assertFalse(adjust(separate, separate.task_id, 'standard', 45)['changed'])

    def test_refine_merge_cycles_keep_user_description_and_total(self):
        root = tree((60,))
        for _ in range(3):
            adjust(root, root.task_id, 'finer', 15)
            adjust(root, 'p-0', 'coarser', 60)
        leaves = list(root.iter_leaves())
        self.assertEqual(len(leaves), 1)
        self.assertEqual(leaves[0].description, 'User checkpoint')
        self.assertEqual(leaves[0].estimated_time, 1)
        fractional = tree((60.4,))
        summary = adjust(fractional, fractional.task_id, 'finer', 20)
        self.assertEqual(summary['beforeMinutes'], summary['afterMinutes'])
        self.assertFalse(adjust(fractional, fractional.task_id, 'finer', 20)['changed'])

    def test_target_boundaries_are_mode_specific_and_strict(self):
        for level, low, high, default in [('finer', 5, 30, 25), ('standard', 25, 60, 45), ('coarser', 45, 120, 90)]:
            self.assertEqual(target_minutes(level, None), default)
            for valid in (low, high):
                self.assertEqual(target_minutes(level, valid), valid)
            for invalid in (low - 1, high + 1, True, '25', 25.5):
                with self.assertRaises(ValueError):
                    target_minutes(level, invalid)


class CalendarCycleTests(unittest.TestCase):
    def assert_no_overlap(self, slots):
        ordered = sorted(slots, key=lambda s: datetime.fromisoformat(s['startTime']).timestamp())
        for left, right in zip(ordered, ordered[1:]):
            self.assertLessEqual(datetime.fromisoformat(left['endTime']).timestamp(), datetime.fromisoformat(right['startTime']).timestamp())

    def test_cycles_accumulate_across_tasks_and_projects_and_report_real_totals(self):
        projects = [project(tree((10,) * 9, 'a')), project(tree((10,) * 9, 'b'))]
        config = {'workStart': '09:00', 'workEnd': '18:00', 'focusMinutes': 25, 'breakMinutes': 5, 'recoveryMinutes': 15, 'cyclesBeforeRecovery': 4}
        slots = build_slots(projects, config)
        self.assert_no_overlap(slots)
        self.assertEqual(sum(slot_minutes(s) for s in work(slots)), 180)
        self.assertTrue(all(slot_minutes(s) <= 25 for s in work(slots)))
        recovery = [s for s in slots if s['kind'] == 'recovery']
        self.assertEqual([(s['start'], s['end']) for s in recovery], [('10:55', '11:10')])
        self.assertTrue(all('taskId' not in s for s in slots if s['kind'] != 'work'))
        self.assertEqual(calendar_changes([], slots, config)['breakMinutes'], 40)
        self.assertEqual(calendar_changes([], slots, config)['availableMinutesPerDay'], 420)
        result = window(slots, {'view': 'day', 'from': '2026-10-26'}, config)
        self.assertEqual(len(result['events']) + len(result['breaks']), len(slots))

    def test_meal_boundary_does_not_double_count_breaks_and_legacy_is_unchanged(self):
        config = {'workStart': '11:30', 'workEnd': '15:00', 'focusMinutes': 25, 'breakMinutes': 15, 'recoveryMinutes': 15, 'cyclesBeforeRecovery': 4}
        slots = build_slots([project(tree((50,)))], config)
        first_break = next(s for s in slots if s['kind'] == 'break')
        self.assertEqual((first_break['start'], first_break['end']), ('11:55', '12:00'))
        self.assertTrue(all(not ('12:00' <= s['start'] < '14:00') for s in slots))
        self.assert_no_overlap(slots)
        for grain, expected in [('fine', 25), ('standard', 45), ('coarse', 90)]:
            settings = {'dailyGranularity': grain}
            self.assertEqual(cycle_settings(settings)['focusMinutes'], expected)
            legacy = build_slots([project(tree((120,)))], settings)
            self.assertTrue(all(s['kind'] == 'work' for s in legacy))
            self.assertEqual(slot_minutes(legacy[0]), expected)

    def test_legacy_two_thirty_minute_tasks_stay_two_blocks_until_cycle_is_configured(self):
        for projects in ([project(tree((30, 30)))], [project(tree((30,), 'a')), project(tree((30,), 'b'))]):
            legacy = build_slots(projects, {})
            self.assertEqual([slot_minutes(s) for s in work(legacy)], [30, 30])
            self.assertEqual(legacy, build_slots(projects, {}, legacy))
            configured = build_slots(projects, {'focusMinutes': 45, 'breakMinutes': 5}, legacy)
            self.assertEqual([slot_minutes(s) for s in work(configured)], [30, 15, 15])
            self.assertEqual([slot_minutes(s) for s in configured if s['kind'] == 'break'], [5])

    def test_effective_date_preserves_earlier_work_and_uses_old_routine_for_new_early_tasks(self):
        root = tree((60, 60))
        root.find_node('p-1').scheduled_date = '2026-10-27'
        projects = [project(root)]
        old = {'workStart': '09:00', 'workEnd': '18:00'}
        before = build_slots(projects, old)
        new = with_routine_change(old, {**old, 'workStart': '14:00', 'focusMinutes': 25, 'breakMinutes': 5, 'recoveryMinutes': 15, 'cyclesBeforeRecovery': 4}, date(2026, 10, 27))
        after = build_slots(projects, new, before)
        self.assertEqual([s for s in before if s['date'] == '2026-10-26'], [s for s in after if s['date'] == '2026-10-26'])
        self.assertEqual(next(s for s in after if s.get('taskId') == 'p-1')['start'], '14:00')
        newcomer = project(tree((30,), 'new'))
        expanded = build_slots(projects + [newcomer], new, after)
        early = next(s for s in expanded if s.get('taskId') == 'new-0')
        self.assertEqual((early['date'], early['start']), ('2026-10-26', '10:00'))
        self.assert_no_overlap(expanded)

    def test_active_and_recorded_work_and_recovery_are_preserved(self):
        root = tree((25, 25, 50))
        settings = {'focusMinutes': 25, 'breakMinutes': 5, 'recoveryMinutes': 15, 'cyclesBeforeRecovery': 4}
        before = build_slots([project(root)], settings)
        root.find_node('p-0').status = TaskStatus.IN_PROGRESS
        root.find_node('p-1').actual_time = .1
        after = build_slots([project(root)], {**settings, 'workStart': '09:15', 'workEnd': '11:00'}, before)
        for key in ('p-0', 'p-1'):
            self.assertEqual([(s['startTime'], s['endTime']) for s in work(before) if s['taskId'] == key], [(s['startTime'], s['endTime']) for s in work(after) if s['taskId'] == key])
        self.assert_no_overlap(after)

    def test_dst_uses_elapsed_minutes_and_keeps_offset_aware_boundaries(self):
        for day in ('2026-03-08', '2026-11-01'):
            settings = {'workStart': '01:30', 'workEnd': '04:00', 'timezone': 'America/New_York', 'focusMinutes': 180, 'breakMinutes': 0, 'recoveryMinutes': 0}
            slots = build_slots([project(tree((120,)), start=day, zone=settings['timezone'])], settings)
            self.assertEqual(sum(slot_minutes(s) for s in work(slots)), 120)
            self.assertTrue(all(slot_minutes(s) > 0 for s in slots))
            self.assert_no_overlap(slots)

    def test_routine_rejects_conflicting_meals_dates_zones_and_cycle_types(self):
        for config in [
            {'workStart': '18:00', 'workEnd': '09:00'},
            {'focusflow': {'lunchStart': 720, 'lunchEnd': 900, 'dinnerStart': 840, 'dinnerEnd': 1000}},
            {'routineDate': '2026-02-30'}, {'routineDate': '2026-1-1'}, {'timezone': 'Missing/Zone'},
            {'focusMinutes': True}, {'breakMinutes': -1}, {'cyclesBeforeRecovery': 0},
        ]:
            with self.assertRaises((ValueError, KeyError)):
                validate_routine(config)


class AdjustmentAPITests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        os.environ['SYA_SCHEDULER_DATA_DIR'] = self.temp.name
        self.app = application()
        self.client = TestClient(self.app)
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)
        os.environ.pop('SYA_SCHEDULER_DATA_DIR', None)
        self.temp.cleanup()

    def preview(self, path, body):
        response = self.client.post('/api/scheduler/' + path + '/preview', json=body)
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()['data']

    def commit(self, draft, request):
        return self.client.post(f"/api/scheduler/plans/{draft['draftId']}/commit", json={'expectedRevision': draft['baseRevision'], 'requestId': request})

    def test_granularity_preview_matches_committed_all_project_slots_and_noop_is_inert(self):
        for prefix in ('a', 'b'):
            self.assertEqual(self.client.post('/api/scheduler/plans/confirm', json={'tree': tree((60,), prefix).model_dump(mode='json')}).status_code, 200)
        draft = self.preview('granularity', {'taskId': 'a-0', 'level': 'finer', 'targetMinutes': 20})
        self.assertEqual(self.commit(draft, 'fine').status_code, 200)
        calendar = self.client.get('/api/scheduler/timeline', params={'projectId': 'all'}).json()['data']
        self.assertEqual([(s['taskId'], s['startTime'], s['endTime']) for s in draft['proposedSlots']], [(s['taskId'], s['startTime'], s['endTime']) for s in calendar['events']])
        config = self.client.get('/api/scheduler/config').json()['data']
        self.assertEqual(config['todayGrain']['targetMinutes'], 20)
        nochange = self.preview('granularity', {'taskId': 'a-root', 'level': 'finer', 'targetMinutes': 20})
        self.assertFalse(nochange['canCommit'])
        self.assertEqual(self.commit(nochange, 'noop').json()['error']['code'], 'NO_CHANGES')
        self.assertEqual(self.client.delete(f"/api/scheduler/plans/{nochange['draftId']}").status_code, 200)

    def test_cycle_preference_without_projects_is_saved_and_same_preview_cannot_commit(self):
        body = {'workStart': '09:00', 'workEnd': '18:00', 'focusMinutes': 25, 'breakMinutes': 5, 'recoveryMinutes': 15, 'cyclesBeforeRecovery': 4, 'date': '2026-10-27'}
        draft = self.preview('routine', body)
        self.assertTrue(draft['canCommit'])
        self.assertEqual(self.commit(draft, 'routine').status_code, 200)
        nochange = self.preview('routine', body)
        self.assertFalse(nochange['canCommit'])
        self.assertEqual(self.commit(nochange, 'noop').status_code, 409)
        self.client.__exit__(None, None, None)
        self.app = application()
        self.client = TestClient(self.app)
        self.client.__enter__()
        config = self.client.get('/api/scheduler/config').json()['data']
        for key in ('focusMinutes', 'breakMinutes', 'recoveryMinutes', 'cyclesBeforeRecovery'):
            self.assertEqual(config[key], body[key])
        self.assertEqual(config['routineDate'], body['date'])

    def test_invalid_public_requests_return_validation_errors(self):
        for body in ({'date': 'tomorrow'}, {'timezone': 'Missing/Zone'}, {'focusMinutes': '25'}, {'focusMinutes': 0}, {'focusflow': {'lunchStart': 900, 'lunchEnd': 800}}):
            self.assertEqual(self.client.post('/api/scheduler/routine/preview', json=body).status_code, 422)

    def test_legacy_config_routine_edit_updates_history_but_metadata_does_not(self):
        draft = self.preview('routine', {'workStart': '09:00', 'workEnd': '18:00'})
        self.assertEqual(self.commit(draft, 'routine').status_code, 200)
        self.assertEqual(self.client.post('/api/scheduler/plans/confirm', json={'tree': tree().model_dump(mode='json')}).status_code, 200)
        changed = self.client.put('/api/scheduler/config', json={'workStart': '14:00'}).json()['data']
        self.assertEqual(changed['workStart'], '14:00')
        before = self.client.get('/api/scheduler/timeline', params={'projectId': 'all'}).json()['data']
        self.assertEqual(before['events'][0]['start'], '14:00')
        self.assertEqual(self.client.put('/api/scheduler/config', json={'focusflow': {'workLog': []}}).status_code, 200)
        self.assertEqual(before, self.client.get('/api/scheduler/timeline', params={'projectId': 'all'}).json()['data'])
