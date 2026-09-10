---
name: Research Timeline
description: 科研任务规划桌面界面。冷灰底、白卡片、蓝强调，时间轴优先。
status: final
updated: 2026-09-11
colors:
  background: '#EEF3F9'
  surface: '#FFFFFF'
  sidebar: '#FFFFFF'
  on-surface: '#0F172A'
  on-surface-muted: '#64748B'
  outline: '#E2E8F0'
  primary: '#3B82F6'
  primary-strong: '#2563EB'
  primary-soft: '#EFF6FF'
  primary-line: '#93C5FD'
  on-primary: '#FFFFFF'
  success: '#3B82F6'
  track: '#E2E8F0'
typography:
  ui:
    fontFamily: 'PingFang SC, Avenir Next, Segoe UI, sans-serif'
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.45'
  title:
    fontFamily: 'PingFang SC, Avenir Next, Segoe UI, sans-serif'
    fontSize: 22px
    fontWeight: '600'
    letterSpacing: '-0.02em'
rounded:
  md: 12px
  lg: 18px
  xl: 24px
  full: 9999px
spacing:
  sidebar: 248px
  gutter: 20px
  card: 22px
---

## Brand & Style

安静的研究工作台，不是暖色 FocusFlow 卡片墙。留白、细线、蓝色节点。参考用户交付的「科研任务规划」稿（`imports/research-timeline.png`）。

## Colors

页面底 `{colors.background}`。侧栏与主卡片 `{colors.surface}`。交互与进度只用 `{colors.primary}`。完成态对勾与进行中描边是同一蓝色，不用绿色替代。

## Typography

中文优先 PingFang SC。课题标题 22px semibold；元数据 12px muted；时间轴节点名 13px。

## Layout & Spacing

三区：248px 侧栏、顶栏、主列（课题头 + 时间轴/月历卡 + 子任务卡）。主列卡片圆角 `{rounded.xl}`，内边距 20–24px。窗口最小约 1080×720。

## Elevation & Depth

卡片用极轻阴影 `0 10px 30px rgba(15, 23, 42, 0.06)`，不用厚投影。选中里程碑用蓝软底，不用描边堆叠。

## Shapes

按钮与输入 12px；大卡片 24px；时间轴节点正圆。

## Components

- **新建规划**：侧栏顶部满宽蓝按钮。
- **时间轴节点**：完成实心蓝+白勾；进行中空心蓝环；未开始浅灰空心。
- **子任务列表**：左列状态点 + 标题；右列清单复选框。
- **进度条**：细胶囊，蓝到青的短渐变。

## Do's and Don'ts

- 用设计稿的蓝白灰，不要回到米色 FocusFlow 主题。
- 不要把整棵树嵌套缩进展示为唯一视图。
- 不要在渲染层写死服务端口。
