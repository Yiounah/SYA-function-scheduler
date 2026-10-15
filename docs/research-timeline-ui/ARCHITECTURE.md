# Architecture

status: accepted-for-implementation  
date: 2026-10-12  
skill: SYA-UI `bmad-architecture` invariants applied to this submodule

## Boundary

FocusFlow remains a **local desktop App** and a **SYA-UI submodule** (`function/scheduler`).

Renderer (`app/static/index.html`) only uses same-origin fetch/WebSocket. Electron (`desktop/main.cjs`) still spawns `bin/scheduler-server` and waits on `/health`. No new ports, no renderer filesystem access, no credentials in the UI.

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
| Voyage | One 课题. The desktop keeps a list; the host still reads the active tree. |
| Navigator | Decompose 课题 → 阶段 → 子任务 → 清单; incremental replan |
| Helm | Record human status (PENDING / IN_PROGRESS / DONE / BLOCKED) |
| Sextant | Completion, delay, **blocked** → fine or coarse next wave |
| Runtime | In-process event bus + memory store (desktop, no Redis) |

State machine: `planning → executing → verifying`. `HUMAN_GATE` is reserved; the App already treats the human as the executor.

## Data mapping

| UI | Task tree |
| --- | --- |
| 课题 | root / Voyage.goal |
| 每日 / 周 / 月 | 桌面用叶子工时、课题期限和共用工作时段算出的排期。服务端树没有日历字段。 |
| 子任务列表 | milestone.children，若为空则里程碑自身 |
| 清单 | subtask.children，若为空则子任务自身（必须是叶子才能 PATCH） |

Blocked leaves are split into micro-tasks (`-m1…`) instead of rebuilding the tree. Completed and blocked nodes are kept; only PENDING children are replaced.

## Client-owned schedule

Day, week, and month views share one planner in `app/static/index.html`. It places leaves into the saved work period, skips meals, and levels concurrent projects. Actual work times, the suggested routine, and today's grain live in `localStorage`. Accepting a new routine re-runs that planner. Accepting today's grain only changes how today's unfinished rows are shown. Neither path calls revise or init.

## Unchanged contracts

`GET /`, `GET /health`, `POST /api/v1/tasks/init`, `PATCH /api/v1/tasks/{id}/status`, `GET /api/v1/tasks/tree`, `WS /ws/tree`, `/api/scheduler/*`, `/manifest`.

`GET /api/v1/projects` is the desktop list. The host single-tree routes still read the active project. `api.openapi.json` also publishes the planner routes other modules call: `projects.list`, `tasks.init`, `tasks.revise`, `tasks.status`, `tasks.translate`, `tasks.tree`, and `voyage.get`. A running server serves the same routes at `/docs`.

## Explicit gaps

Restart clears every project. There is no server-side calendar, and today's grain is not sent to the model. Parent Dashboard IPC stays outside this UI. Packaged Electron and a live model call are not claimed by the service tests.
