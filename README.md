# Scheduler Function

SYA scheduler function module with cognitive task decomposition and rolling-wave
planning. The same repository supports two entry modes:

- Git submodule and local HTTP function runtime inside `SYA-UI`.
- Standalone `SYA Scheduler.app` on macOS, with the existing browser dashboard
  hosted inside an Electron window.

In the parent app this repo is linked as:

```text
function/scheduler
```

## What It Owns

- Natural-language decomposition through `decompose`.
- Scheduler-compatible task, timeline, stats, and config actions.
- Hierarchical task trees backed by `sya_task_scheduler`.
- Rolling-wave replanning that replaces pending work while preserving completed
  task history.
- Local debug page and legacy `/api/v1/tasks/*` endpoints for backend testing.
- Standalone macOS desktop shell with a bundled Python runtime.

For an implementation-grounded list of everything the module currently does,
including current data and API constraints, see
[`docs/CURRENT_FUNCTIONALITY.md`](docs/CURRENT_FUNCTIONALITY.md).

## Required SYA Files

```text
module.json
manifest.json
api.openapi.json
bin/scheduler-server
assets/
mock/
sya_task_scheduler/
```

`manifest.json` starts the local HTTP runtime. `api.openapi.json` defines the
Function API action names used by the Electron bridge.

## Function API

| Operation ID | Method | Path |
| --- | --- | --- |
| `health` | `GET` | `/health` |
| `manifest` | `GET` | `/manifest` |
| `decompose` | `POST` | `/api/scheduler/decompose` |
| `tasks.list` | `GET` | `/api/scheduler/tasks` |
| `tasks.get` | `GET` | `/api/scheduler/tasks/{taskId}` |
| `tasks.update` | `PUT` | `/api/scheduler/tasks/{taskId}` |
| `tasks.delete` | `DELETE` | `/api/scheduler/tasks/{taskId}` |
| `timeline.get` | `GET` | `/api/scheduler/timeline` |
| `tasks.reorder` | `POST` | `/api/scheduler/tasks/reorder` |
| `stats.get` | `GET` | `/api/scheduler/stats` |
| `config.get` | `GET` | `/api/scheduler/config` |
| `config.update` | `PUT` | `/api/scheduler/config` |

All endpoints except `/manifest` return:

```json
{ "ok": true, "data": {} }
```

The legacy debug routes remain under `/api/v1/tasks/*`, and the debug page is
served from `/`.

## Mock Data

`mock/` follows the same structure as `SYA-UI/function/scheduler/mock`:

```text
mock/README.md
mock/data.json
mock/server.py
```

Use it when the real function runtime is not ready but the UI needs stable
integration-test data:

```bash
cd mock
python3 server.py
```

The mock server listens on `http://127.0.0.1:8766` by default and implements
the `/api/scheduler/*` endpoints with common sample tasks.

## Local Run

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r sya_task_scheduler/requirements.txt
npm test
PORT=8000 bin/scheduler-server
```

Open `http://127.0.0.1:8000` for the debug dashboard.

No LLM key is required for local tests. Without `SYA_OPENAI_API_KEY`, the
runtime uses deterministic mock plans.

## Standalone macOS App

Development mode uses the same FastAPI runtime and dashboard as the submodule:

```bash
npm install
python3.11 -m venv sya_task_scheduler/.venv
source sya_task_scheduler/.venv/bin/activate
pip install -r sya_task_scheduler/requirements.txt
npm run app:dev
```

Use any Python 3.11 or newer interpreter in place of `python3.11`. The Electron
main process allocates a localhost port, starts `bin/scheduler-server`, waits
for `/health`, and opens the dashboard. Runtime output is written to
`~/Library/Logs/SYA Scheduler/scheduler-runtime.log`.

Build an installable app for the current Mac architecture:

```bash
npm install
npm run app:dist:mac
```

The packaging command uses PyInstaller to produce a self-contained Scheduler
server and then embeds it in the Electron app. The generated `.dmg` and `.zip`
are written to `release/`; the installed app does not require a separate Python
installation. The local build is not Developer ID signed or notarized, so
macOS may require an explicit first-open confirmation.

## Build Artifact

```bash
npm run build
```

This writes:

```text
dist/sya-function-scheduler-0.1.0-<target>.tar.gz
```

The archive contains the files required by the SYA Electron function runtime.
This function archive uses the Python launcher in `bin/scheduler-server`, so the
host must provide Python 3.11+ and the dependencies in
`sya_task_scheduler/requirements.txt`. The standalone macOS package described
above embeds its own executable runtime and has no such host-Python dependency.

## Parent Repo Integration

From the SYA-UI parent repository, pin this repo at `function/scheduler`.

If `function/scheduler` is already a submodule:

```bash
git checkout dev
git pull --ff-only
git submodule set-url function/scheduler https://github.com/Yiounah/SYA-function-scheduler.git
git submodule update --init --recursive --remote function/scheduler
git add .gitmodules function/scheduler
git commit -m "feat: update scheduler function module"
```

If `function/scheduler` does not exist yet:

```bash
git checkout dev
git pull --ff-only
git submodule add -b main https://github.com/Yiounah/SYA-function-scheduler.git function/scheduler
git add .gitmodules function/scheduler
git commit -m "feat: add scheduler function module"
```

If UI changes are needed for new actions, add a feedback note in the parent
repo docs so the UI owner can map the new API to renderer features.
