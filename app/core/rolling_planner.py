"""Compatibility re-export. Prefer `app.agents.voyage.plan_edit.PlanEditor`."""

from app.agents.voyage.plan_edit import PlanEditor as RollingWavePlanner

__all__ = ["RollingWavePlanner"]
