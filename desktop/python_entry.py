"""Entry point bundled into the standalone desktop app runtime."""

from __future__ import annotations

import os

import uvicorn
from app.main import app as scheduler_app


def main() -> None:
    """Run the Scheduler API on the localhost port selected by Electron."""

    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run(
        scheduler_app,
        host=host,
        port=port,
        access_log=False,
        log_level="info",
    )


if __name__ == "__main__":
    main()
