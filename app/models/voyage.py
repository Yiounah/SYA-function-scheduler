"""Voyage run: one long-horizon 课题 as a resumable plan-execute-verify loop."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field


class VoyagePhase(str, Enum):
    """Persistent state machine for a FocusFlow planning run.

    Mirrors Polaris Voyage phases, adapted to a local desktop App:
    the human is Helm's executor, so EXECUTING waits on status updates.
    """

    PLANNING = "planning"
    EXECUTING = "executing"
    VERIFYING = "verifying"
    HUMAN_GATE = "human_gate"


class Voyage(BaseModel):
    """One 课题 / long-horizon goal tracked as an auditable run."""

    model_config = ConfigDict(extra="forbid", strict=True)

    voyage_id: str = Field(default_factory=lambda: uuid4().hex)
    goal: str = Field(min_length=1)
    persona: str = Field(min_length=1)
    deadline_days: int | None = Field(default=None, ge=1)
    phase: VoyagePhase = VoyagePhase.PLANNING
    human_gate_reason: str | None = None
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
