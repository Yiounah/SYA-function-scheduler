# Delivery evidence

date: 2026-09-11  
request: apply SYA-UI BMAD skills in `SYA-function-scheduler` and implement the research-timeline UI

## Requirement

- Explicit user request: 使用 SYA-UI Agent Skill 的产品/需求/UX/架构/实现/审查/测试/证据流程，并按交付设计图改界面。
- IDs: SCH-001 (input surface), SCH-002 (existing decompose, unchanged), SCH-003 (timeline visualization).
- Non-goals: SCH-004, SCH-005, SCH-006 persistence, SCH-007–009.

## Review notes

- Renderer still uses same-origin APIs only.
- No OpenAPI/manifest/port change.
- Checklist “添加清单项” is disabled; items come from the planner tree.
- Parent PRD status text was not silently rewritten; it still disagrees with current scheduler source.

## Evidence

| Level | What ran | Result |
| --- | --- | --- |
| Static | Markup contains 科研任务规划 / 新建规划 / 时间轴 / 日历 / 我的课题 | pass |
| Service/source | `.venv/bin/python -m unittest tests.test_smoke -v` | 5 tests OK |
| Service/source | `GET /health` and `GET /` on local runtime | 200 |
| Renderer GUI | click-through in Electron window | not executed this pass |
| Packaged Electron | `app:dist:mac` | not executed |
| OS/hardware | — | n/a |

## How to view

```bash
source .venv/bin/activate
npm run app:dev
```
