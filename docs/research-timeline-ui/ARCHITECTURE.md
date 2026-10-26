# Architecture

status: accepted-for-implementation  
date: 2026-10-26
skill: SYA-UI `bmad-architecture` invariants applied to this submodule

## Boundary

FocusFlow remains a **local desktop App** and a **SYA-UI submodule** (`function/scheduler`).

Renderer (`app/static/index.html`, `app.js`, `styles.css`) only uses same-origin fetch/WebSocket. The service exposes only the named static resources. Electron (`desktop/main.cjs`) still spawns `bin/scheduler-server` and waits on `/health`. No new ports, no renderer filesystem access, no credentials in the UI.

Root contracts stay at the module root so the parent host can register `local-http`:

- `manifest.json` `id=scheduler`, `runtime=local-http`, `entry.command=bin/scheduler-server`
- `api.openapi.json`, `module.json`, `package.json`
- `uvicorn app.main:app`

## Polaris mapping (adapted for an App)

Polaris is a research platform. FocusFlow keeps the same **layers and Voyage loop**, but Helm is the human, not a tool runner.

```text
app/                 FastAPI package (Polaris: src/backend/app)
  api/               thin routers
  services/          App-facing workflows (planning, timeline DTO)
  models/            task tree + Voyage
  agents/voyage/     Navigator / Helm / Sextant / PlanEditor
  core/              config, event bus, memory store, llm/
  static/            desktop UI
desktop/             Electron shell (Polaris: src/desktop)
bin/scheduler-server SYA + App entry (do not rename)
```

| Polaris | FocusFlow |
| --- | --- |
| Voyage | One 课题. Both UIs select projects explicitly; legacy calls may default to the active tree. |
| Navigator | Decompose 课题 → 阶段 → 子任务 → 清单; incremental replan |
| Helm | Record human status (PENDING / IN_PROGRESS / DONE / BLOCKED) |
| Sextant | Completion, delay, **blocked** → fine or coarse next wave |
| Runtime | In-process event bus + memory store (desktop, no Redis) |

State machine: `planning → executing → verifying`. `HUMAN_GATE` is reserved; the App already treats the human as the executor.

## Data mapping

| UI | Task tree |
| --- | --- |
| 课题 | root / Voyage.goal |
| 每日 / 周 / 月 | 同一个 `timeline.get` 服务端排期，包含项目 ID、任务 ID、日期与带时区的开始结束时间。 |
| 子任务列表 | milestone.children，若为空则里程碑自身 |
| 清单 | subtask.children，若为空则子任务自身（必须是叶子才能 PATCH） |

The legacy Voyage route may generate micro-tasks. Revisioned UI journeys use the planner service: pending and blocked leaves may be adjusted, while active and terminal leaves are protected. Neither UI independently computes the production schedule.

## Revisioned planner and shared schedule

`app/services/planner_desk.py` owns drafts, revisions, idempotent confirmations and stable schedule slots. Both the standalone UI and SYA-UI render the same schedule. A plan, granularity change or routine change is previewed without changing the official tree, then committed with its base revision and request ID. A task update invalidates older drafts. Finer steps remain siblings at checklist depth; coarser steps retain source IDs. Active and completed work is protected.

`planner.json` stores projects, preferences, revision, slots and confirmation receipts. The service writes durable state before publishing it to readers. A file lock and disk revision comparison protect concurrent standalone/host processes sharing the same directory. Requests refresh state changed by the other process; stale confirmations fail instead of overwriting it. `desktop/main.cjs` points `SYA_SCHEDULER_DATA_DIR` at SYA-UI's `userData/scheduler` unless explicitly configured. The renderer still has no filesystem access; local storage is only a display cache.

`granularity.py` owns bounded duration splitting and compatible adjacent merging. It preserves descriptions, execution, source IDs and total duration without calling a model. `calendar.py` owns dated routine snapshots and work/rest cycles across projects. Work events remain in `timeline.events`, rest periods in `timeline.breaks`. Old schedules with no confirmed cycle configuration retain their original block length and no inserted breaks. Neither UI has a second production calendar algorithm.

## Compatible contracts

`GET /`, `GET /health`, `POST /api/v1/tasks/init`, `PATCH /api/v1/tasks/{id}/status`, `GET /api/v1/tasks/tree`, `WS /ws/tree`, `/api/scheduler/*`, `/manifest`.

`GET /api/v1/projects` is the desktop list. The host single-tree routes still read the active project. `api.openapi.json` also publishes the planner routes other modules call: `projects.list`, `tasks.init`, `tasks.revise`, `tasks.status`, `tasks.translate`, `tasks.tree`, and `voyage.get`. A running server serves the same routes at `/docs`.

New UI journeys use `plans.preview`, `plans.commit`, `plans.cancel`, `granularity.preview` and `routine.preview`. `tasks.tree` accepts an explicit project; multi-project lists and timelines accept `projectId=all`. `task.updated` causes the host to read the current snapshot again. `plans.confirm` is a compatibility import for a new tree, not an unchecked replacement of an existing plan.

## Explicit gaps

Projects, progress, routine and schedule survive restart when `SYA_SCHEDULER_DATA_DIR` is set. Parent integration uses feature API → preload IPC → FunctionHost → HTTP owner. Focus remains the sole owner of session IDs. No external calendar provider is required. Service tests alone do not establish Electron acceptance, a packaged release or a live model call; executed evidence is recorded separately in `EVIDENCE.md`.
