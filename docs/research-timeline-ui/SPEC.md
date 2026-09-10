# SPEC — 科研任务规划时间轴

status: accepted-for-implementation  
date: 2026-09-11  
source: SYA-UI BMAD (`bmad-spec` kernel) · user design handoff · SCH-001 / SCH-002 / SCH-003  
repo: `SYA-function-scheduler` (SYA-UI submodule `function/scheduler`)

## Why

研究者要把一个跨学期的长程课题拆成可见的阶段和下一步。当前 FocusFlow 两栏「目标 / 树」无法表达时间顺序、当前里程碑和清单执行。用户提供的桌面设计把同一棵任务树呈现为「课题 → 时间轴 → 子任务 → 清单」。

## Capabilities

- CAP-1: 用「新建规划」提交长程目标与粒度，调用既有 `POST /api/v1/tasks/init`。
- CAP-2: 根节点为当前课题；一级子节点为时间轴里程碑（SCH-003）。
- CAP-3: 选中里程碑后展示其子任务列表；选中子任务后展示叶子清单并更新状态（既有 `PATCH /api/v1/tasks/{id}/status`）。
- CAP-4: 时间轴与月历两种导航，周/月范围切换；进度来自叶子完成比例。
- CAP-5: 顶栏搜索过滤当前课题内的阶段与子任务标题。

## Constraints

- 不改 OpenAPI 契约、不新增 sidecar 端口、不把凭证暴露给渲染层。
- 后端仍是单棵内存任务树；多课题持久化（SCH-006）本期不做。
- 里程碑日期由 `estimated_time` 从今天起推算，任务模型暂无真实日历字段。
- 界面语言为简体中文；证据级别以源码服务测试为主，不声称已打包安装验证。

## Non-goals

- SCH-004 桌面小组件、SCH-005 优先级、SCH-007–009 父应用 Dashboard 入口。
- 真实日历拖拽改期、多课题服务端存储、在清单中任意新增后端节点。

## Success signal

桌面窗口打开后可完成：新建规划 → 看到时间轴阶段 → 选中阶段查看子任务 → 勾选叶子并反映进度；`tests/test_smoke.py` 通过，且 UI 含设计图中的主结构文案。
