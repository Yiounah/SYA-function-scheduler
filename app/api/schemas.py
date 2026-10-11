"""HTTP DTO models for the desktop App and SYA function bridge."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models.task_tree import TaskStatus


class InitTaskRequest(BaseModel):
    """Request body for a new long-horizon planning run."""

    model_config = ConfigDict(extra="forbid", strict=True)

    goal: str = Field(min_length=1)
    persona: str = Field(default="balanced", min_length=1)
    deadline_days: int | None = Field(default=None, ge=1)


class UpdateTaskStatusRequest(BaseModel):
    """Request body for leaf-task status updates."""

    model_config = ConfigDict(extra="forbid")

    status: TaskStatus
    actual_time: float | None = Field(default=None, ge=0)


class TranslateNode(BaseModel):
    """One task title and description sent for display translation."""

    model_config = ConfigDict(extra="forbid", strict=True)

    task_id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    description: str = ""


class TranslateRequest(BaseModel):
    """Request to show the English plan in Chinese, or restore English wording."""

    model_config = ConfigDict(extra="forbid", strict=True)

    target: Literal["zh", "en"]
    nodes: list[TranslateNode] = Field(min_length=1, max_length=200)


class TranslateResponse(BaseModel):
    """Translated titles and descriptions. Task ids stay the same."""

    model_config = ConfigDict(extra="forbid", strict=True)

    nodes: list[TranslateNode]


class EventAckResponse(BaseModel):
    """Acknowledgement that a planning event was queued."""

    model_config = ConfigDict(extra="forbid", strict=True)

    accepted: bool
    event_id: str
