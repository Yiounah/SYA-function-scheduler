# FocusFlow

## 2026-10-29：统一 SYA 任务入口与课题切换

SYA 的“规划任务”、控制中心“任务”及 `/schedule` 直接打开 Scheduler 界面；移除旧任务表单与“高级规划器”中间入口，沿用 Electron 的 `openSchedulerUi`、同源服务及同一持久化目录。主应用全局导航保留，Scheduler 模块内部不再显示左侧栏或任务树导航按钮。

标题文案保持不变；标题区右侧从上到下为“新建规划”和“我的课题”。鼠标悬浮、点击或键盘均可打开课题浮层，首项为“全部课题”，随后纵向排列所有课题；Escape、点击外部或焦点离开可收起。窄窗口按钮换行，浮层限制在窗口内并可滚动。选中课题显示原有周期、期限、完成率和任务树；全部课题展示可点击的各课题进度卡，完成率按已完成清单数 / 总清单数计算。选择会在当前浏览器存储中保留，刷新读取服务最新进度；切换本身不修改计划。

顶部作息和粒度入口、下方日周月行动日历、调整/延期与 Focus 交接继续复用原实现。浮层采用浏览器原生 [Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API/Using)，交互参考 [WAI disclosure navigation](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/)，未增加组件依赖。

FocusFlow 把一个很长的目标拆成阶段，以及你现在就能做的下一步。

[模块作用、功能演示与持续专注评估说明](docs/scheduler-guide.md)记录 Scheduler 的范围、创新定位及 A5 参考来源。本轮完善目标分钟细化与同父合并、实际专注/休息周期、生效日期和前后影响预览；正式任务与执行记录仍通过统一草案确认保存。任务完成和计时运行不等于持续专注。

## Agent SDLC 开发框架

本仓库已经内置一套面向 FocusFlow 的项目级 Agent SDLC。它不是另一个应用或运行时服务，而是由 BMAD、TEA、OpenCode Skills、项目知识和 GitHub 质量门禁组成的 AI 辅助软件工程流程。它用于让产品分析、需求、UX、架构、实现、审查、测试和交付证据遵循同一套项目规则。

当前固定版本为 BMAD/BMM `6.12.0`、TEA `v1.24.0` 和 OpenCode `1.18.29`，共提供 39 个仓库级 Skills。版本与完整性记录位于 `agent-sdlc.lock.json`。

### 它的作用

- 让 AI 先识别产品意图、已接受规格、接口契约和当前实现证据，再修改代码。
- 为产品、UX、架构、开发和测试提供职责明确的 Agent 与工作流。
- 将需求、实现、测试和 PR 证据串联起来，减少只改代码、不更新契约或测试的情况。
- 区分静态检查、服务/源码契约、打包 Electron 和真实 OS 等证据等级，避免用低等级测试声称高等级能力已经完成。
- 在 PR 中执行只读质量门禁；该门禁不会打包发布，也不会读取模型密钥。

该框架不会替代 `docs/research-timeline-ui/` 里已接受的规格、根目录的 OpenAPI / manifest，或实际测试结果。它也不能代替 SYA-UI 父仓库里的产品需求文档。父应用要带上这里的改动时，还需要更新父仓库的 submodule 指针。

### 第一次启动

在仓库根目录准备 Git、uv、Python `>=3.11`、Node `>=22.12.0` 和 npm `>=10.9.0`，然后验证项目级框架：

```bash
scripts/verify-agent-sdlc.sh
```

启动固定版本的 OpenCode：

```bash
npx --yes opencode-ai@1.18.29 .
```

OpenCode 会从 `.agents/skills/` 发现 39 个 Skills，并读取仓库根目录的 `AGENTS.md`。安装或更新 Skills 后需要退出并重新启动 OpenCode。

日常开发不需要重复安装框架。只有安装损坏或经过审核的版本升级才运行：

```bash
scripts/install-agent-sdlc.sh
```

不要手工修改 `_bmad/config.toml`、`_bmad/*/config.yaml` 或 `.agents/skills/`；团队级定制应写入 `_bmad/custom/`。

### 如何让 AI 使用框架

进入 OpenCode 后，最稳妥的入口是：

```text
/bmad-help
```

随后说明目标、需求 ID 或用户请求、验收标准和期望证据。`bmad-help` 会根据任务规模推荐最短的工作流；小型修复不需要机械地执行完整产品流程。

如果使用的 AI 客户端不支持 slash command，可以直接发送：

```text
请先读取 AGENTS.md 和 docs/bmad-project-knowledge/README.md，
然后使用 bmad-help 为当前任务选择最短且充分的 BMAD/TEA 工作流。
```

建议每次给 AI 的任务至少包含以下信息：

```text
使用 /bmad-help 处理以下 FocusFlow 任务。

目标：<用户最终要得到什么>
需求 ID：<例如 SCH-003；没有现有 ID 时写“明确用户请求”>
验收标准：<可观察、可测试的完成条件>
范围：<允许修改的界面、Voyage 层、接口或文档>
证据：<需要静态检查、Python 测试、开发态桌面或打包安装包中的哪一级>
排除项：<本次明确不做的内容>

开始实现前先核对权威来源和现有代码。发现冲突时列出文件与证据，不要自行合并
矛盾结论。完成后运行对应验证，并报告修改文件、结果和未验证边界。不要执行发布。
```

### 常用调用

| 任务 | 调用 |
| --- | --- |
| 不确定下一步或不知道选哪个 Agent | `/bmad-help` |
| 把想法整理为产品方向 | `/bmad-product-brief` |
| 把一个明确改动整理为精简规格 | `/bmad-spec` |
| 创建、更新或检查 PRD | `/bmad-prd` |
| 设计或检查交互体验 | `/bmad-ux` |
| 明确跨模块架构约束 | `/bmad-architecture` |
| 拆分 Epic、Story 和 Sprint | `/bmad-create-epics-and-stories`、`/bmad-sprint-planning` |
| 根据已确认需求实现功能或修复 | `/bmad-build` |
| 设计验收测试或先写失败测试 | `/bmad-testarch-test-design`、`/bmad-testarch-atdd` |
| 扩展自动化测试 | `/bmad-testarch-automate` |
| 审查代码和测试质量 | `/bmad-code-review`、`/bmad-testarch-test-review` |
| 建立需求到测试的追踪和门禁结论 | `/bmad-testarch-trace` |
| 引导人工验收或完成复盘 | `/bmad-walkthrough`、`/bmad-retrospective` |

需要直接与角色讨论时，可以调用 `/bmad-agent-analyst`、`/bmad-agent-pm`、`/bmad-agent-ux-designer`、`/bmad-agent-architect`、`/bmad-agent-dev` 或 `/bmad-tea`。角色会加载 FocusFlow 项目知识并显示自己的可用菜单。

典型的新功能链路是：

```text
product brief/spec -> PRD -> UX -> architecture -> epics/stories
-> test design/ATDD -> build -> automate -> code/test review
-> trace -> walkthrough -> retrospective
```

### 调用示例

实现一个已有需求：

```text
/bmad-build
实现 SCH-003 的时间轴阶段展示。先读取 docs/research-timeline-ui/SPEC.md、
现有静态界面、OpenAPI 和 tests/test_smoke.py，列出验收标准后再修改。
至少运行 npm test；不要把浏览器里的静态检查说成已打包安装验证。
```

处理一个缺陷：

```text
/bmad-spec
问题：勾选叶子清单后，时间轴进度没有跟着变化。请先复现并建立精简规格，
保留现有 PATCH 状态契约，定义回归测试和不在本次处理的范围；规格确认后再交给 bmad-build。
```

审查当前改动：

```text
/bmad-code-review
审查当前未提交改动。重点检查需求与实现是否一致、静态界面是否绕过了同源接口、
OpenAPI 契约、回归风险和缺失测试。先列出有文件和行号的发现，不要执行发布操作。
```

### 框架文件和产物

| 路径 | 用途 |
| --- | --- |
| `AGENTS.md` | 所有 AI 在本仓库必须遵守的工程规则和已知风险 |
| `docs/bmad-project-knowledge/README.md` | FocusFlow 权威来源、架构边界、需求和证据规则 |
| `.agents/skills/` | OpenCode 自动发现的 39 个 BMAD/TEA Skills |
| `_bmad/custom/` | 可提交的 FocusFlow 团队级 Agent 和工作流定制 |
| `_bmad-output/` | 被 Git 忽略的规划、实现和测试工作产物 |
| `agent-sdlc.lock.json` | 工具版本、完整性、Skills 和已接受范围锁 |
| `scripts/verify-agent-sdlc.sh` | 本地完整框架与 OpenCode 验证入口 |
| `.github/workflows/pr-quality.yml` | 无发布副作用的 PR 质量门禁 |

AI 生成的草稿默认放在 `_bmad-output/`。确认后的长期规格应回写 `docs/research-timeline-ui/` 或新的 `docs/` 文档，架构知识应回写 `docs/`，可执行验收应进入 `tests/`。不要把 `_bmad-output/` 当成第二份长期 PRD。

详细的版本、GitHub 门禁和更新规则见 [`docs/agent-sdlc.md`](docs/agent-sdlc.md)。

## 长程规划与主 APP 对接（2026-10-26）

独立窗口和 SYA-UI 任务工作区共用 Scheduler 服务合同：输入目标 → 四层草案 → 确认保存 → 日/周/月查看 → 开始或完成清单。AI 草案可取消；模型错误不会自动替换成成功示例。演示预览需要主动选择并显示示例标识。

- `plans.preview`、`granularity.preview`、`routine.preview` 返回 `draftId`、`baseRevision`、四层树和建议时间块；预览不改正式计划。
- `plans.commit` 接收 `expectedRevision` 与 `requestId`，拒绝过期或并发冲突，重复同一次确认返回原回执。`plans.cancel` 撤销草案。
- `timeline.get` 支持日期范围、日/周/月视图、时区和项目；多个视图使用同一份保存的排期。`tasks.tree` 显式选择项目，列表与时间线可使用 `projectId=all`。
- Monitor 黄色提醒先打开任务绑定的粒度预览；Focus 管理真实会话编号；结束专注不自动完成任务。Deep Search 恢复时回读最新任务并返回 Focus。
- 设置 `SYA_SCHEDULER_DATA_DIR` 后，正式树、任务进度、排期、作息和确认回执保存到 `planner.json`；文件锁与磁盘版本比较保护多个本地进程的并发修改。

需求和边界见 [SPEC](docs/research-timeline-ui/SPEC.md)，接口以根目录 `api.openapi.json` 为准，实际验证见 [EVIDENCE](docs/research-timeline-ui/EVIDENCE.md)。本地源码修改不会自动更新父仓库 gitlink 或已安装的发行包。

## 任务树主界面（2026-10-29）

工作区顶部保留标题区完整文案：“SCHEDULE · 任务规划”“把目标，变成今天的一小步。”“先确定方向，再安排节奏。计划可以调整，每一次改变都由你确认。”课题概览与任务树始终是主区域：阶段横向排列，每个阶段下面纵向展示子任务和清单。点击阶段或子任务标题可独立收起、展开，也可一键全部展开/收起。阶段用左右箭头排序，子任务和清单用上下箭头排序；只调整同级完整顺序，不改变任务归属和完成状态。顺序与按课题保存的展开偏好可在重启后恢复。

搜索会临时展开匹配的路径，清空后恢复原来的折叠状态。日历放在任务树下方，可展开或收起；其中可切换“每日行动日历”“每周行动周报”“每月行动月历”，切换时任务树和同一套日历标题、视图按钮、日期选择、左右箭头、“今天”及工作块计数保持展示。课题从标题区的“我的课题”切换；日、周、月只通过日历卡片右上角切换。“节奏设置”及作息、粒度按钮位于顶部“任务规划”栏的标题与搜索框之间，继续打开原有调整与确认流程。SYA-UI 的默认任务模块直接使用这份界面及主应用的 Scheduler 数据目录。详见 [模块功能说明](docs/scheduler-guide.md)。

## 固定粒度与每日行动日历（2026-10-28 后续调整）

任务粒度改为四选一：**更细 25 分钟、标准 45 分钟、更粗 90 分钟、自定义 5–120 分钟**。输入自定义时长会取消预设选择；切回预设后只使用该预设的固定分钟数。预览和确认仍由原 Scheduler 服务完成，保持总时长、来源和已执行任务。

日、周、月完整复用 SYA-UI 的 `ScheduleCalendar`：头部、任务卡片、休息段和操作按钮一致，只改变标题及查询日期范围。旧周报横条和月历网格已经移除，周/月内的每个工作块同样可以开始专注、调整/延期或完成任务。日期范围及翻页来自主库 `model`：左右箭头分别移动一天、一周或一个月；月视图尽量保留日号，目标月没有该日时落在月末，例如 11/30 → 12/30、1/31 → 2/28（闰年为 2/29）。`TaskEditor` 和 `granularity` 继续使用主库源码编译产物。共享组件放在 Shadow DOM 中，避免主应用样式与独立窗口互相覆盖。“调整 / 延期”使用可见的模态编辑器，编辑内容、安排日期或截止日期后明确保存，也可取消；保存失败保留输入并显示错误。

本地源码模式的“开始专注”复用主应用现有 `/focus` 页面和 Focus owner，传递所选任务与工作块时长，由用户再次确认开始，不在 Scheduler 内创建另一套计时器。原生交接的实际验收以 [EVIDENCE](docs/research-timeline-ui/EVIDENCE.md) 当轮记录为准。

共享产物维护在 `app/static/shared/`，不手改生成的 JS/CSS。在 SYA-UI 根目录执行 `npm run build:scheduler-calendar --workspace app` 更新嵌入子模块；若更新独立仓库，追加 `-- --out-dir /path/to/SYA-function-scheduler/app/static/shared`。`source-manifest.json` 记录主库源码与产物哈希、依赖版本，许可信息随包保存。

## 快速开始（给使用者）

用已经打好的 Mac 安装包，不需要安装 Python 或 Node。

1. 打开 `release/` 里的 `FocusFlow-*.dmg`（或从发布页下载同名安装包）
2. 把 **FocusFlow** 拖进「应用程序」
3. 打开 FocusFlow
4. 点标题区右侧「新建规划」，写下长程目标，选择规划粒度，生成研究时间轴
5. 在任务树里展开阶段和子任务，把眼前的清单标成进行中或完成；需要查看时间安排时，展开下方日历，在每日行动日历开始专注或调整 / 延期

没有配置模型 Key 时，AI 预览会明确提示不可用；可以主动选择「演示预览」查看带标识的内置示例，或在主 APP 手动填写计划。旧 `tasks.init/decompose` 的示例兼容路径不代表真实模型生成。

## 从源码运行（给开发者）

改代码、看最新界面时用这条路径，不要用旧的 `.dmg`。

准备：macOS、[Python 3.11+](https://www.python.org/downloads/)、[Node.js](https://nodejs.org/)。

```bash
git clone https://github.com/Yiounah/SYA-function-scheduler.git
cd SYA-function-scheduler

python3.13 -m venv .venv   # 必须是 3.11+；macOS 自带 python3 通常是 3.9，不能用
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
npm install
npm run app:dev
```

- `npm run app:dev`：开发模式，直接打开当前源码。改完再运行一次即可看到更新。
- `npm run app:dist:mac`：打包模式，生成别人也能安装的 `release/*.dmg`。包里是打包那一刻的代码，之后改源码要重新打包。

要用项目实际可用的模型做真正拆解时：到 [智谱开放平台](https://bigmodel.cn/usercenter/proj-mgmt/apikeys) 创建 Key，填进 `.env` 的 `SYA_OPENAI_API_KEY=`，然后重新运行 `npm run app:dev`。

SYA-UI 内嵌服务读取其 `function/scheduler/.env`；它与独立仓库的 `.env` 是两个本地文件。配置后重启相应应用才能生效。真实 Key 仅保存在 Git 忽略的本地配置中，不写入 renderer、文档或示例文件。

规划预览失败会返回固定诊断码：`MODEL_NOT_CONFIGURED` 表示未配置 Key，`MODEL_AUTH_FAILED` 表示 Key 或模型访问权限被拒绝，`MODEL_RATE_LIMITED` 表示限流，`MODEL_TIMEOUT` 表示超时，`MODEL_RESPONSE_INVALID` 表示回复为空、截断或不是有效 JSON，其余模型服务失败使用 `MODEL_UNAVAILABLE`。这些失败不会自动保存示例计划，也不把供应商响应正文或密钥返回页面。当前 GLM-5.3 请求保留 `thinking.type=enabled` 和 `reasoning_effort=low`，符合[智谱官方模型说明](https://docs.bigmodel.cn/cn/guide/models/text/glm-5.3)。

## 仓库结构

FocusFlow 是独立桌面 App，也是 SYA-UI 的 `function/scheduler` 子模块。规划核心按 Polaris Voyage 分层，但入口仍在仓库根目录，父应用契约不变。

```text
manifest.json / api.openapi.json / module.json / package.json
bin/scheduler-server     # SYA local-http 与桌面 App 共用入口
app/                     # FastAPI（uvicorn app.main:app）
  api/                   # 薄路由
  services/              # 业务编排
  models/                # 任务树与 Voyage
  agents/voyage/         # Navigator 规划 / Helm 记录人的执行 / Sextant 校验再规划
  core/                  # 配置、事件总线、内存状态、唯一 LLM 边界
  static/                # 桌面 UI
desktop/                 # Electron 壳
tests/ docs/
```

