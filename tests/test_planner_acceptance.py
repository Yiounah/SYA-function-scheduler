"""Acceptance of confirmation, concurrency, calendar and cross-module contracts."""
from __future__ import annotations

import asyncio
import json
import os
import tempfile
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path
from unittest.mock import AsyncMock, patch

os.environ['SYA_OPENAI_API_KEY'] = ''

from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.api import register_routes
from app.main import lifespan
from app.services.planner_desk import ConcurrentPlannerWrite, PlannerDesk


def leaves(node):
    if not node['children']:
        return [node]
    return [leaf for child in node['children'] for leaf in leaves(child)]


def depths(node, depth=0):
    if not node['children']:
        return [depth]
    return [d for child in node['children'] for d in depths(child, depth + 1)]


def application():
    app = FastAPI(lifespan=lifespan)
    register_routes(app)
    return app


class PlannerAcceptanceTests(unittest.TestCase):
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

    def sample(self, goal='Research project'):
        response = self.client.post('/api/scheduler/plans/preview', json={'goal': goal, 'allowSample': True, 'deadline_days': 7})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()['data']

    def commit(self, draft, request='confirm-1'):
        return self.client.post(f"/api/scheduler/plans/{draft['draftId']}/commit", json={'expectedRevision': draft['baseRevision'], 'requestId': request})

    def test_sample_is_explicit_four_level_and_never_calls_provider(self):
        with patch.object(self.app.state.container.llm_gateway, 'generate_task_tree', new=AsyncMock(side_effect=AssertionError('sample called model'))):
            draft = self.sample()
        self.assertEqual(draft['generationMode'], 'sample')
        self.assertEqual(set(depths(draft['tree'])), {3})
        self.assertEqual(self.client.get('/api/v1/projects').json()['projects'], [])
        self.assertFalse((Path(self.temp.name) / 'planner.json').exists())
        self.assertEqual(self.commit(draft).status_code, 200)
        self.assertEqual(self.client.get('/api/v1/projects').json()['projects'][0]['generationMode'], 'sample')

    def test_cancel_is_inert_and_cannot_be_committed(self):
        draft = self.sample()
        cancelled = self.client.delete(f"/api/scheduler/plans/{draft['draftId']}")
        self.assertTrue(cancelled.json()['data']['cancelled'])
        self.assertEqual(self.commit(draft).status_code, 409)
        self.assertFalse((Path(self.temp.name) / 'planner.json').exists())

    def test_confirmation_retry_survives_restart_and_key_cannot_confirm_another_draft(self):
        draft = self.sample()
        result = self.commit(draft).json()['data']
        self.client.__exit__(None, None, None)
        self.app = application()
        self.client = TestClient(self.app)
        self.client.__enter__()
        self.assertEqual(self.commit(draft).json()['data'], result)
        other = self.sample('Other project')
        self.assertEqual(self.commit(other).json()['error']['code'], 'REQUEST_ID_REUSED')
        self.assertEqual(len(self.client.get('/api/v1/projects').json()['projects']), 1)

    def test_status_changes_invalidate_old_draft_and_preserve_done_work(self):
        original = self.sample()
        self.commit(original)
        leaf = leaves(original['tree'])[0]
        grain = self.client.post('/api/scheduler/granularity/preview', json={'taskId': original['tree']['task_id'], 'level': 'finer'}).json()['data']
        status = self.client.patch(f"/api/v1/tasks/{leaf['task_id']}/status", json={'status': 'DONE'})
        self.assertEqual(status.status_code, 200)
        self.assertEqual(self.commit(grain, 'grain').json()['error']['code'], 'STALE_DRAFT')
        fresh = self.client.post('/api/scheduler/granularity/preview', json={'taskId': original['tree']['task_id'], 'level': 'finer'}).json()['data']
        self.assertEqual(set(depths(fresh['tree'])), {3})
        kept = next(n for n in leaves(fresh['tree']) if n['task_id'] == leaf['task_id'])
        self.assertEqual(kept['status'], 'DONE')
        self.assertEqual(kept['title'], leaf['title'])
        self.assertEqual(self.commit(fresh, 'grain-confirm').status_code, 200)
        telemetry = self.client.get('/api/scheduler/telemetry').json()['data']['events']
        self.assertEqual(sum(e['event'] == 'schedule.task_completed' for e in telemetry), 1)

    def test_monitor_on_running_leaf_only_adjusts_its_unstarted_sibling(self):
        original = self.sample()
        self.commit(original)
        first = leaves(original['tree'])[0]
        self.client.patch(f"/api/v1/tasks/{first['task_id']}/status", json={'status': 'IN_PROGRESS'})
        response = self.client.post('/api/scheduler/granularity/preview', json={'taskId': first['task_id'], 'level': 'finer', 'reason': 'monitor-yellow', 'focusSessionId': 'focus-actual-1'})
        self.assertEqual(response.status_code, 200, response.text)
        draft = response.json()['data']
        kept = next(n for n in leaves(draft['tree']) if n['task_id'] == first['task_id'])
        self.assertEqual(kept['title'], first['title'])
        self.assertEqual(kept['status'], 'IN_PROGRESS')
        self.assertEqual(draft['context']['focusSessionId'], 'focus-actual-1')
        self.assertEqual(set(depths(draft['tree'])), {3})
        self.assertEqual(len(leaves(draft['tree'])), len(leaves(original['tree'])) + 1)

    def test_routine_uses_same_commit_and_keeps_finished_slots(self):
        original = self.sample()
        self.commit(original)
        first = leaves(original['tree'])[0]
        self.client.patch(f"/api/v1/tasks/{first['task_id']}/status", json={'status': 'DONE'})
        before = self.client.get('/api/scheduler/timeline', params={'projectId': 'all'}).json()['data']['events']
        draft = self.client.post('/api/scheduler/routine/preview', json={'workStart': '14:00', 'workEnd': '17:00', 'timezone': 'Asia/Shanghai'}).json()['data']
        self.assertEqual(self.client.get('/api/scheduler/config').json()['data']['workStart'], '09:00')
        self.assertEqual(self.commit(draft, 'routine').status_code, 200)
        after = self.client.get('/api/scheduler/timeline', params={'projectId': 'all'}).json()['data']['events']
        self.assertEqual([e for e in before if e['taskId'] == first['task_id']], [e for e in after if e['taskId'] == first['task_id']])
        self.assertTrue(all(e['start'] >= '14:00' for e in after if e['taskId'] != first['task_id']))

    def test_daily_weekly_monthly_read_one_stable_calendar_without_overlap(self):
        for index in range(2):
            self.commit(self.sample(f'Project {index}'), f'project-{index}')
        all_slots = self.client.get('/api/scheduler/timeline', params={'projectId': 'all'}).json()['data']['events']
        first_day = min(s['date'] for s in all_slots)
        for view in ['day', 'week', 'month']:
            slots = self.client.get('/api/scheduler/timeline', params={'projectId': 'all', 'from': first_day, 'view': view}).json()['data']['events']
            self.assertTrue(slots)
            self.assertTrue(all(slot in all_slots for slot in slots))
            self.assertTrue(all(datetime.fromisoformat(slot['startTime']).utcoffset() is not None for slot in slots))
        ordered = sorted(all_slots, key=lambda s: s['startTime'])
        self.assertTrue(all(a['endTime'] <= b['startTime'] for a, b in zip(ordered, ordered[1:])))
        self.assertTrue(all(not ('12:00' <= s['start'] < '14:00') for s in all_slots))
        self.client.__exit__(None, None, None)
        self.app = application(); self.client = TestClient(self.app); self.client.__enter__()
        self.assertEqual(self.client.get('/api/scheduler/timeline', params={'projectId': 'all'}).json()['data']['events'], all_slots)

    def test_storage_failure_leaves_tree_revision_and_draft_retryable(self):
        draft = self.sample()
        with patch.object(self.app.state.container.planner_desk, 'save', side_effect=OSError('disk full')):
            response = self.commit(draft)
        self.assertEqual(response.status_code, 503)
        self.assertEqual(self.client.get('/api/v1/projects').json()['projects'], [])
        self.assertEqual(self.app.state.container.planner_desk.revision, draft['baseRevision'])
        self.assertEqual(self.commit(draft).status_code, 200)

    def test_status_storage_failure_rolls_back_live_tree(self):
        draft = self.sample(); self.commit(draft)
        leaf = leaves(draft['tree'])[0]
        with patch.object(self.app.state.container.planner_desk, 'save', side_effect=OSError('disk full')):
            response = self.client.patch(f"/api/v1/tasks/{leaf['task_id']}/status", json={'status': 'DONE'})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(self.client.get(f"/api/scheduler/tasks/{leaf['task_id']}").json()['data']['status'], 'pending')

    def test_invalid_input_is_rejected_without_server_error(self):
        for body in [{'workStart': '99:00'}, {'workStart': '12:00', 'workEnd': '13:00'}, {'timezone': 'Mars/Example'}, {'date': 'tomorrow'}]:
            self.assertEqual(self.client.post('/api/scheduler/routine/preview', json=body).status_code, 422)
        for query in [{'view': 'year'}, {'from': 'bad'}, {'from': '2026-10-22', 'to': '2026-10-01'}, {'timezone': 'Mars/Example'}]:
            self.assertEqual(self.client.get('/api/scheduler/timeline', params=query).status_code, 422)
        self.assertEqual(self.client.patch('/api/v1/tasks/missing/status', json={'status': 'DONE'}).status_code, 404)

    def test_second_process_refreshes_and_rejects_stale_draft(self):
        original = self.sample(); self.commit(original)
        with TestClient(application()) as other:
            draft = other.post('/api/scheduler/granularity/preview', json={'taskId': original['tree']['task_id'], 'level': 'finer'}).json()['data']
            first = leaves(original['tree'])[0]
            self.client.patch(f"/api/v1/tasks/{first['task_id']}/status", json={'status': 'DONE'})
            stale = other.post(f"/api/scheduler/plans/{draft['draftId']}/commit", json={'expectedRevision': draft['baseRevision'], 'requestId': 'other-process'})
            self.assertEqual(stale.status_code, 409)
            self.assertEqual(other.get(f"/api/scheduler/tasks/{first['task_id']}").json()['data']['status'], 'completed')
            events = other.get('/api/scheduler/telemetry').json()['data']['events']
            self.assertEqual(len(events), len({event['id'] for event in events}))
            self.client.put(f"/api/scheduler/tasks/{first['task_id']}", json={'title': 'Updated completed title'})
            refreshed = other.get('/api/scheduler/telemetry').json()['data']['events']
            self.assertEqual(len(refreshed), len({event['id'] for event in refreshed}))
            slots = other.get('/api/scheduler/timeline', params={'projectId': 'all'}).json()['data']['events']
            self.assertTrue(all(slot['title'] == 'Updated completed title' for slot in slots if slot['taskId'] == first['task_id']))

    def test_cross_process_file_compare_and_swap_has_one_winner(self):
        barrier = threading.Barrier(2)
        def write():
            desk = PlannerDesk(); desk.revision = 1
            barrier.wait()
            try:
                desk.save([])
                return 'saved'
            except ConcurrentPlannerWrite:
                return 'conflict'
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: write(), range(2)))
        self.assertCountEqual(results, ['saved', 'conflict'])
        self.assertEqual(json.loads((Path(self.temp.name) / 'planner.json').read_text())['revision'], 1)

    def test_all_projects_are_addressable_by_focus_and_search(self):
        first = self.sample('First'); first_result = self.commit(first).json()['data']
        self.commit(self.sample('Second'), 'second')
        leaf = leaves(first['tree'])[0]
        detail = self.client.get(f"/api/scheduler/tasks/{leaf['task_id']}").json()['data']
        self.assertEqual(detail['projectId'], first_result['projectId'])
        updated = self.client.put(f"/api/scheduler/tasks/{leaf['task_id']}", json={'status': 'in_progress'})
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json()['data']['status'], 'in_progress')
        self.assertEqual(len(self.client.get('/api/v1/projects').json()['projects']), 2)

    def test_host_routine_edits_normalize_the_standalone_representation(self):
        initial = self.client.put('/api/scheduler/config', json={
            'workStart': '10:00', 'workEnd': '18:00',
            'focusflow': {'periodStart': 600, 'periodEnd': 1080, 'hoursPerDay': 6, 'lunchStart': 720, 'lunchEnd': 840, 'dinnerStart': 1080, 'dinnerEnd': 1200},
        })
        self.assertEqual(initial.status_code, 200, initial.text)
        draft_response = self.client.post('/api/scheduler/routine/preview', json={'workStart': '09:00', 'workEnd': '16:00'})
        self.assertEqual(draft_response.status_code, 200, draft_response.text)
        draft = draft_response.json()['data']
        self.assertEqual(draft['suggestion']['focusflow']['hoursPerDay'], 5)
        self.assertEqual(self.commit(draft).status_code, 200)
        saved = self.client.get('/api/scheduler/config').json()['data']
        self.assertEqual((saved['workStart'], saved['focusflow']['periodStart']), ('09:00', 540))
        self.assertEqual((saved['workEnd'], saved['focusflow']['periodEnd']), ('16:00', 960))
        self.assertEqual(saved['focusflow']['hoursPerDay'], 5)
        metadata = self.client.put('/api/scheduler/config', json={'focusflow': {'workLog': []}}).json()['data']
        self.assertEqual(metadata['focusflow']['hoursPerDay'], 5)
        self.assertEqual(metadata['workStart'], '09:00')

    def test_explicit_inconsistent_routine_is_rejected_without_writing(self):
        response = self.client.post('/api/scheduler/routine/preview', json={'workStart': '09:00', 'workEnd': '18:00', 'focusflow': {'periodStart': 600, 'periodEnd': 1080, 'hoursPerDay': 7}})
        self.assertEqual(response.status_code, 422)
        response = self.client.post('/api/scheduler/routine/preview', json={'workStart': '09:00', 'workEnd': '18:00', 'focusflow': {'periodStart': 540, 'periodEnd': 1080, 'hoursPerDay': 8}})
        self.assertEqual(response.status_code, 422)
        self.assertFalse((Path(self.temp.name) / 'planner.json').exists())

    def test_reorder_targets_its_owner_and_cannot_mix_project_ids(self):
        first = self.sample('First'); self.commit(first)
        second = self.sample('Second'); self.commit(second, 'second')
        first_ids = [node['task_id'] for node in first['tree']['children']]
        response = self.client.post('/api/scheduler/tasks/reorder', json={'taskIds': list(reversed(first_ids))})
        self.assertEqual(response.status_code, 200, response.text)
        projects = self.client.get('/api/v1/projects').json()['projects']
        self.assertEqual([n['task_id'] for n in projects[0]['tree']['children']], list(reversed(first_ids)))
        self.assertEqual([n['task_id'] for n in projects[1]['tree']['children']], [n['task_id'] for n in second['tree']['children']])
        bad = self.client.post('/api/scheduler/tasks/reorder', json={'taskIds': [first_ids[0], second['tree']['children'][0]['task_id']]})
        self.assertEqual(bad.status_code, 422)
        duplicate = self.client.post('/api/scheduler/tasks/reorder', json={'taskIds': [first_ids[0], first_ids[0]]})
        self.assertEqual(duplicate.status_code, 422)

    def test_granularity_choice_is_persisted_in_the_same_confirmation(self):
        original = self.sample(); self.commit(original)
        draft = self.client.post('/api/scheduler/granularity/preview', json={'taskId': original['tree']['task_id'], 'level': 'finer'}).json()['data']
        self.assertNotIn('todayGrain', self.client.get('/api/scheduler/config').json()['data'])
        result = self.commit(draft, 'grain-label').json()['data']
        config = self.client.get('/api/scheduler/config').json()['data']
        today = config['todayGrain']['date']
        self.assertEqual(config['todayGrain']['level'], 'fine')
        self.assertEqual(config['focusflow']['dayGrain'][today], 'fine')
        self.assertEqual(config['focusflow']['dayGrainDismissed'], f'{today}|fine')
        self.assertEqual(result['revision'], draft['baseRevision'] + 1)
        self.client.__exit__(None, None, None)
        self.app = application(); self.client = TestClient(self.app); self.client.__enter__()
        restored = self.client.get('/api/scheduler/config').json()['data']
        self.assertEqual(restored['todayGrain'], config['todayGrain'])
        self.assertEqual(restored['focusflow']['dayGrain'][today], 'fine')
