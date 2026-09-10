# Architecture

status: accepted-for-implementation  
date: 2026-09-11  
skill: SYA-UI `bmad-architecture` invariants applied to this submodule

## Boundary

FocusFlow remains a local desktop runtime. Renderer (`app/static/index.html`) only uses same-origin fetch/WebSocket. Electron (`desktop/main.cjs`) still spawns `bin/scheduler-server` and waits on `/health`. No new ports, no renderer filesystem access, no credentials in the UI.

## Data mapping

| UI | Task tree |
| --- | --- |
| 课题 | root |
| 时间轴 / 月历节点 | `root.children` |
| 子任务列表 | milestone.children，若为空则里程碑自身 |
| 清单 | subtask.children，若为空则子任务自身（必须是叶子才能 PATCH） |

Dates are derived: `estimated_time` hours → at least 3 calendar days, starting today. The domain model has no `due_at` field in this pass.

## Unchanged contracts

`GET /`, `GET /health`, `POST /api/v1/tasks/init`, `PATCH /api/v1/tasks/{id}/status`, `GET /api/v1/tasks/tree`, `WS /ws/tree`.

## Explicit gaps

Parent PRD SCH-006 persistence and multi-project server storage are not added. Sidebar “我的课题” currently shows the single in-memory tree. Parent Dashboard IPC integration is unchanged and out of this submodule UI pass.
