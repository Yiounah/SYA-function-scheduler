---
name: Research Timeline Experience
status: final
updated: 2026-09-11
form_factor: macOS Electron desktop
visual: ./DESIGN.md
---

## Foundation

macOS 桌面窗口。视觉身份见 `DESIGN.md`。数据仍走 FocusFlow 本地 HTTP：`/`, `/health`, `/api/v1/tasks/*`, `/ws/tree`。

## Information Architecture

| 表面 | 内容 |
| --- | --- |
| 侧栏 | 新建规划；导航（时间轴 / 日历）；我的课题（当前内存树） |
| 顶栏 | 产品名「科研任务规划」；搜索 |
| 课题头 | 根标题、周期、整体进度 |
| 研究时间轴 | 一级子节点，周视图 |
| 月历 | 同一批里程碑落在推算日期上 |
| 子任务卡 | 选中里程碑的子节点 + 选中子任务的叶子清单 |

树映射：root = 课题；`root.children` = 里程碑；里程碑 children 或自身 = 子任务；子任务 children 或自身叶子 = 清单项。

## Voice and Tone

短、具体、研究场景。「开始规划」改为「生成时间轴」。「还没有路线图」改为「还没有课题」。

## Component Patterns

- 新建规划打开模态：目标 + 规划粒度，提交后等待树就绪。
- 点击里程碑只改变选择，不改状态。
- 点击子任务：若为叶子则标为进行中；若有子节点则只选择。
- 清单勾选：叶子 `DONE` / 取消为 `PENDING`。
- 保存进度：重新拉取树并提示已同步。

## State Patterns

- 空：无树。时间轴与子任务显示空态，引导新建规划。
- 规划中：主按钮忙碌，禁止重复提交。
- 有树：默认选中第一个进行中或未完成里程碑。
- 搜索无结果：子任务列显示「没有匹配的任务」。

## Interaction Primitives

单击选择；复选框切换完成；Escape 关闭模态。无拖拽改期。

## Accessibility Floor

搜索框有 label；模态有标题；时间轴节点有 button 语义；toast 使用 `aria-live=polite`。

## Key Flows

1. 林（研究生）打开应用 → 点「新建规划」→ 输入论文级目标 → 生成时间轴。
2. 高潮：在「设计实验方案」节点看到子任务清单，勾选「开源基座模型权重」，进度条上升。
3. 切到日历确认后续节点落在哪一周。
