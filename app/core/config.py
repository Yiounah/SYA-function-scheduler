"""Cross-cutting runtime configuration (Polaris `core/` layer)."""

from __future__ import annotations

import sys
from functools import lru_cache
from pathlib import Path

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_ROOT = Path(__file__).resolve().parents[2]
_PRIVATE_MODEL = Path.home() / ".config" / "sya" / "scheduler" / "model.env"


class Settings(BaseSettings):
    """Desktop App settings with threshold-driven replanning policy."""

    model_config = SettingsConfigDict(
        env_file=str(_ROOT / ".env"),
        env_file_encoding="utf-8",
        env_prefix="SYA_",
        extra="ignore",
        validate_default=True,
    )

    app_name: str = "FocusFlow"
    debug: bool = False

    completion_low_threshold: float = Field(default=0.6, ge=0.0, le=1.0)
    completion_high_threshold: float = Field(default=0.9, ge=0.0, le=1.0)
    evaluation_leaf_batch_size: int = Field(default=3, ge=1)
    metrics_window_size: int = Field(default=10, ge=1)

    event_history_maxlen: int = Field(default=2000, ge=100)
    ws_ping_interval_seconds: int = Field(default=20, ge=5)

    scheduler_private_model: bool = False
    scheduler_model_base_url: str = Field(default="", repr=False, exclude=True)
    scheduler_model_key: str = Field(default="", repr=False, exclude=True)
    scheduler_model_name: str = "gpt-6.1-sol"
    llm_timeout_seconds: int = Field(default=90, ge=5)

    @model_validator(mode="after")
    def validate_threshold_order(self) -> "Settings":
        """Ensure low-threshold is strictly below high-threshold."""
        if self.completion_low_threshold >= self.completion_high_threshold:
            raise ValueError(
                "completion_low_threshold must be lower than completion_high_threshold"
            )
        return self


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached settings object for dependency injection."""
    settings = Settings()
    if settings.scheduler_private_model or getattr(sys, "frozen", False):
        return Settings(_env_file=(_PRIVATE_MODEL, _ROOT / ".env"))
    return settings
