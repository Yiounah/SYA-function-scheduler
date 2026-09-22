"""HTTP DTO models for the desktop App and SYA function bridge."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from app.models.task_tree import TaskStatus


class InitTaskRequest(BaseModel):
    """Request body for a new long-horizon planning run."""

    model_config = ConfigDict(extra="forbid", strict=True)

    goal: str = Field(min_length=1)
    persona: str = Field(default="balanced", min_length=1)


class UpdateTaskStatusRequest(BaseModel):
    """Request body for leaf-task status updates."""

    model_config = ConfigDict(extra="forbid")

    status: TaskStatus
    actual_time: float | None = Field(default=None, ge=0)


class EventAckResponse(BaseModel):
    """Acknowledgement that a planning event was queued."""

    model_config = ConfigDict(extra="forbid", strict=True)

    accepted: bool
    event_id: str
