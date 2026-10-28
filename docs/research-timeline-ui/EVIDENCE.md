# Delivery evidence

## 2026-10-28 后续：互斥粒度与主库行动日历

- `SYA_OPENAI_API_KEY='' npm test`：71 项 Python 回归与桌面脚本语法检查通过。新增共享资源白名单、路径拒绝及原有认证门禁检查；固定预设、自定义范围、旧参数规范化和保存恢复覆盖保持通过。
- `node scripts/test-planner-electron.mjs` 最终串行验收 **25/25** 通过。实际 Electron 42.3.3 / Chromium 148.0.7778.218，隔离源码目录和 profile；外部模型仅使用固定 HTTP fixture，未读取真实密钥或个人计划。
- 直接复用主库 ScheduleCalendar/TaskEditor 的日视图验证：25/45/90 互斥且请求不夹带自定义时长、custom 20 分钟保存恢复、调整弹窗立即显示并聚焦、取消不落盘、真实目录写入失败保留输入后可重试、延期在日/周/月和真实退出重启后保持一致。研究周报和月历保留。
- 最终证据：`_bmad-output/planner-electron/2026-10-28T11-12-24-924Z/result.json`；`pageErrors=[]`，`cleanup.survivors=[]`，模型 fixture 已关闭。证据中记录可执行文件、临时源码/profile 和完整源码/资源 SHA256；截图不提交。
- 本套件只断言“开始专注”按钮可用；真实跨主应用 Focus 交接已由 SYA-UI 的 `app/scripts/test-scheduler-tree-electron.mjs` 分别验证通过：嵌入与独立入口均需确认后启动真实会话，重复交接不覆盖正在进行的会话，来源窗口仍可继续操作，退出后无测试进程残留。详见主仓库集成说明。
- 排查并修复共享资源路由及工作区重复 React；测试本身按真实 UI 关闭异步粒度建议，并将合成用餐时段避开实际观测分钟，避免晚餐期间把正确的保护行为误判为建议失败。没有替换排期服务、UI API 或时间。


## 2026-10-28 可折叠任务树专项验收

- Python 单元与 HTTP 回归共 68 项通过；新用例覆盖阶段/子任务/清单同级排序、非法请求不写入、活动课题不变、落盘失败回滚、重启、进度及已执行时间块保留。测试显式禁用真实模型密钥。
- `scripts/test-planner-electron.mjs` 真实 Electron 42.3.3 最终串行验收 21/21 通过：课题头卡、横向阶段、纵向树、键盘折叠、刷新与重启恢复、三层排序、搜索临时展开、窄屏、细粒度、作息及旧草案拒绝。延迟真实折叠配置请求后立即预览，验证预览等待写入并可成功提交。
- 最终证据在忽略目录 `_bmad-output/planner-electron/2026-10-28T08-37-10-404Z/result.json`，包括源码哈希、版本、隔离 profile/data、截图和清理结果。`pageErrors=[]`，`survivors=[]`；两次生命周期均使用真实 `app.quit`，未保留测试进程。
- SYA-UI 编译后的主应用专项通过真实 preload/IPC/FunctionHost 和 Python owner，验证宿主建计划 → 高级规划器读取 → 勾选完成/排序 → 宿主回读 → 真退出/重启；应用内只读 API 页面展示完整同级排序合同。证据为主仓库 `_bmad-output/scheduler-task-tree/report.json`，2026-10-28T08:34:15Z 至 08:34:33Z。
- 原生 UI 套件最终串行执行，避免两个 Electron 自动化窗口互抢输入。独立测试在外部模型 HTTP 边界使用固定回复；宿主专项仅用手动合成树，不访问模型、个人计划或 `.env`。本记录是源码 App 验收，不代表已发布签名安装包。

交互参考 [WAI-ARIA Disclosure Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)，使用原生按钮与 CSS grid，没有新增树控件依赖。

## 2026-10-26 Scheduler 粒度与作息专项最终验收

本轮仅完善 Scheduler 及其主 APP 界面；不新增 Focus/Monitor/Search/Gatekeeper 功能。目标分钟拆分/兼容合并、工作与休息周期、生效日期、变更摘要及简化后的两处界面已验证。修复了跳过计为完成、无样本建议，以及未确认周期时旧的两个30分钟任务被切成三块的兼容问题。

- `npm test`：59 项 Python 测试全部通过，并检查 Electron 与抽离的 app.js 语法。
- `scripts/test-planner-electron.mjs`：15 组真实独立 Electron 操作通过，含 CAP-8 两次时段外操作、取消/采纳、真实休息、退出重启；无 renderer 错误及残留进程。
- 主 APP TypeScript、相关 ESLint、18 条浏览器流程通过；`test-design-journeys-electron.mjs` 34/34 路径通过（真实主进程、preload、FunctionHost、Python owner、重启回读）。
- 原生截图及报告使用合成任务，模型仅在外部接口边界替换为固定回复；不证明真实供应商、注意传感器、签名或发布安装包。
- Function 合同检查通过，文档 API 生成及本地 Docusaurus 编译通过；完整发布同步仍被既有 parent gitlink 与子模块 HEAD 不一致的保护阻止。快照明确标记 working-tree-uncommitted，未修改发布保护。

主 APP 最终验收：2026-10-26T09:21:25.098Z 至 2026-10-26T09:22:07.650Z；Electron 42.3.3。renderer `dist/assets/index-07ITAnEu.js` SHA256 `2d40bf4965a6fb93d6995c9726baf520e4b349373159283636ac14d2525d6506`。main/preload SHA256分别为 `03920274852b3217940a308ac42f3f2b52e92c3d04e37f0d941fa639d997b659` / `2778c5dca9358b463488fb704aaaa5cddfd3ef61afd8cb9d141b8ddfacb7720b`。

独立窗口最终证据已复制到 `_bmad-output/scheduler-acceptance/standalone-final/`；主 APP 证据位于父仓库 `_bmad-output/design-journeys/electron/evidence.json`。模块说明与专注评估边界见 `docs/scheduler-guide.md`。


Scope: user-requested S1–S8 Scheduler completion and integration with SYA-UI, based on the supplied Schedule supplement. Existing uncommitted work was preserved and extended. The independent module and parent `function/scheduler` source copy are synchronized; no commit, push, release or gitlink update was performed.

## Executed verification

- `npm test`: 41 Python tests passed, followed by Electron shell syntax checks. Coverage includes draft cancellation, idempotent retries across restart, stale revision rejection, disk-write rollback, cross-process file CAS, four-level grain changes, protected active/completed tasks, routine normalization, cross-project sorting, shared day/week/month slots and timezone validation.
- `node scripts/test-planner-electron.mjs`: 13 real standalone Electron journeys passed. This launches the real desktop shell and Python service in an isolated temporary profile, substitutes only the external model HTTP boundary, clicks the actual UI, quits and relaunches, and verifies that no owned Electron or Python process remains.
- Standalone journeys include initial routine preview/cancel/confirm; new plan cancel/confirm; shared calendars; completion and stale-draft rejection; grain cancel/confirm and protected completed nodes; routine preview and rest preferences; model failure/retry; generation cancellation and late responses; explicit sample labeling; exact Monitor task/session handling; and persistence after restart.
- Main-app compiled source Electron: 34/34 paths passed on 2026-10-26, including the real preload/IPC/FunctionHost chain, Scheduler → Focus → Search recovery, Monitor preview/cancel/commit, Gatekeeper session recap, true exit/relaunch, and no remaining owned processes. Electron 42.3.3 / Chromium 148.0.7778.218 / Electron Node 24.15.0; Scheduler Python 3.13.5. The in-app read-only API reference displays the new operations.
- The main project's renderer regressions passed 16/16 in installed Chrome, including a commit that succeeds on the server but loses its first response: retry reuses the original draft and request ID. TypeScript and changed-file ESLint passed.
- Four-module source contracts and Scheduler research-event checks passed in SYA-UI. A checkpoint/status edit is not counted as a complete planning dialogue; preview/cancel are not adoption, and confirmation retries keep one identity.

Standalone report and screenshots are in ignored `_bmad-output/scheduler-acceptance/standalone/`. Main-app Electron verification and precise build/profile details are recorded by SYA-UI in `_bmad-output/design-journeys/electron/evidence.json` and its testing documentation.

## Boundaries

- Model HTTP replies are fixed fixtures. No live GLM/other provider quality, credentials, OS sensors, signing or packaged-release claim is made.
- Source Electron acceptance does not update an installed application. Publishing requires a reviewed module commit, matching parent gitlink and appropriate runtime artifacts.
- The legacy `tasks.update` edit contract retains last-write behavior; the new preview/commit flow has optimistic concurrency protection.
- Parent `test:functions` as a whole requires the currently uninitialized Monitor source. The available four modules were checked explicitly. The Scheduler uses the real owner with fixed model fixtures rather than a separate mock implementation.
- The parent documentation publication command remains guarded by its existing mismatched Scheduler gitlink. The updated contract snapshot is explicitly marked as uncommitted working-tree content; local API generation and static documentation rendering are separate from publication provenance.

## References used

Implementation reused the existing stack and standard facilities; no new runtime framework was added. References: [FastAPI responses](https://fastapi.tiangolo.com/tutorial/response-model/), [Python file replacement](https://docs.python.org/3.11/library/os.html#os.replace), [Playwright Electron](https://playwright.dev/docs/api/class-electron), [Electron IPC](https://www.electronjs.org/docs/latest/tutorial/ipc), and [React Effect cleanup](https://react.dev/reference/react/useEffect).

---

## Historical record — 2026-10-12

date: 2026-10-12  
request: reconcile FocusFlow with the Agent SDLC records and keep the desktop planner logic easy to follow

## Requirement

- Explicit user request: 按 Agent SDLC 整理产品分析、需求、UX、架构、实现、审查、测试和交付证据，并让代码保持简洁、逻辑清楚。
- Accepted records: `docs/research-timeline-ui/SPEC.md` CAP-1 through CAP-9, `EXPERIENCE.md`, `DESIGN.md`, `ARCHITECTURE.md`.
- Project knowledge: `docs/bmad-project-knowledge/README.md`.
- Non-goals: SCH-004, SCH-005, SCH-006 persistence, SCH-007–009, a second PRD under `_bmad-output/`.

## Review

- The accepted spec, experience, architecture, and project knowledge disagreed with the desktop: they still described one tree, the old product name, and a fixed six-hour day. Those records now match the code.
- `renderAll` asked for a daily-grain suggestion on every redraw, including project switches. The suggestion now runs after the tree is loaded and after the routine dialog closes.
- `package.json` listed `build` twice. The duplicate key is gone.
- Today's grain still does not call the model. It only changes how today is shown.
- Renderer still uses same-origin APIs. No OpenAPI or manifest change.

## Evidence

| Level | What ran | Result |
| --- | --- | --- |
| Service/source | `npm test` (16 Python tests, then `node --check` on the Electron shell) | pass |
| Desktop dev | this pass did not click through a running window | gap |
| Packaged Electron | `npm run app:dist:mac` | not run |
| Live model | tests use the empty-key mock plan | gap |

## How to view

```bash
npm run app:dev
```
