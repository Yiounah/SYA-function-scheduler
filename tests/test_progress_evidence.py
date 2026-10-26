"""Do not promote missing or skipped work into evidence of sustained focus."""

import unittest

from app.agents.voyage.checks import TaskExecutionSample, decide_replan_strategy, evaluate_progress
from app.models.task_tree import TaskStatus


class ProgressEvidenceTests(unittest.TestCase):
    def test_skipped_work_is_not_completed_or_used_for_duration_overrun(self):
        metrics = evaluate_progress([
            TaskExecutionSample(task_id="done", status=TaskStatus.DONE, estimated_time=1.0, actual_time=1.5),
            TaskExecutionSample(task_id="skipped", status=TaskStatus.SKIPPED, estimated_time=1.0, actual_time=9.0),
            TaskExecutionSample(task_id="blocked", status=TaskStatus.BLOCKED, estimated_time=1.0),
        ])
        self.assertEqual(metrics.completion_rate, 1 / 3)
        self.assertEqual(metrics.procrastination_index, 0.5)
        self.assertEqual(metrics.blocked_count, 1)
        self.assertEqual(metrics.sample_size, 3)

    def test_missing_evidence_does_not_trigger_replanning(self):
        self.assertEqual(decide_replan_strategy(
            metrics=evaluate_progress([]), low_threshold=0.4, high_threshold=0.8,
        ), "none")

    def test_all_skipped_does_not_recommend_coarser_tasks(self):
        metrics = evaluate_progress([
            TaskExecutionSample(task_id="skipped", status=TaskStatus.SKIPPED, estimated_time=1.0),
        ])
        self.assertEqual(metrics.completion_rate, 0)
        self.assertNotEqual(decide_replan_strategy(
            metrics=metrics, low_threshold=0.4, high_threshold=0.8,
        ), "coarse")
