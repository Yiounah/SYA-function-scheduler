# Scheduler 当前功能说明

本文只描述仓库当前代码已经实现并可调用的行为。当前版本为 `0.1.0`。

## 1. 运行形态

| 形态 | 当前行为 |
| --- | --- |
| SYA Function | 通过 `manifest.json` 和 `api.openapi.json` 声明 `local-http` 运行时，可作为 `SYA-UI/function/scheduler` 子模块使用 |
| 本地服务 | `bin/scheduler-server` 启动 FastAPI/uvicorn 服务，默认监听 `127.0.0.1:8000` |
| macOS App | Electron 启动独立 Scheduler 服务、等待健康检查并加载内置操作界面；安装包内含 PyInstaller 生成的服务端可执行文件 |
| 浏览器调试页 | `/` 提供目标输入、persona 选择、任务树查看、叶子状态更新、统计摘要和 WebSocket 事件日志 |
| Mock 服务 | `mock/server.py` 在默认端口 `8766` 提供固定的 `/api/scheduler/*` 联调数据 |

所有实际规划状态都保存在进程内存中；停止服务或退出 App 后，目标、任务树、事件历史和执行样本不会保留。

## 2. 任务规划与执行闭环

- 接收自然语言目标并生成任意层级的任务树；任务节点包含标题、描述、状态、预计时长、实际时长、父子关系。
- 支持 `balanced`、`micro`、`macro` 三种 persona。`/api/v1/tasks/init` 会使用传入 persona；Function API 的 `decompose` 当前固定使用 `balanced`。
- 配置 `SYA_OPENAI_API_KEY` 后，通过 OpenAI-compatible `/chat/completions` 和 JSON Schema 请求任务树；未配置密钥或远程请求失败时，自动使用确定性的本地计划。
- 支持任务状态 `PENDING`、`IN_PROGRESS`、`DONE`、`BLOCKED`、`SKIPPED`，并记录可选的实际耗时。
- 每累计 3 个叶子任务首次进入终态（默认配置）后，对最近 10 条执行样本计算完成率和拖延指数。
- 完成率低于 `0.6` 时选择更深的待处理分支做细粒度重规划；高于 `0.9` 时选择更浅的分支做粗粒度重规划；两者之间不重规划。
- 重规划只替换目标节点下仍为 `PENDING` 的直接子节点，保留非 pending 子节点及其执行历史。
- 内部异步事件总线按 FIFO 出队并向订阅者广播；事件历史上限默认 2000 条。

## 3. SYA Function API

除 `/manifest` 外，`/health` 和 `/api/scheduler/*` 返回 `{ "ok": true, "data": ... }` 包装。

| Operation ID | 接口 | 当前行为 |
| --- | --- | --- |
| `health` | `GET /health` | 返回模块 ID、版本和健康状态 |
| `manifest` | `GET /manifest` | 返回 Function 运行时声明 |
| `decompose` | `POST /api/scheduler/decompose` | 用 `input` 创建新任务树，返回叶子任务、顺序时间线和事件 ID；`attachments` 当前仅通过校验，不参与规划 |
| `tasks.list` | `GET /api/scheduler/tasks` | 深度优先返回根节点之外的所有节点，可按准确的 scheduler 状态字符串过滤 |
| `tasks.get` | `GET /api/scheduler/tasks/{taskId}` | 按 ID 返回一个任务；不存在时返回 404 |
| `tasks.update` | `PUT /api/scheduler/tasks/{taskId}` | 可更新状态、`actualMinutes`、标题和描述；其他字段不写入任务树 |
| `tasks.delete` | `DELETE /api/scheduler/tasks/{taskId}` | 删除非根节点及其子树；根节点不可删除 |
| `timeline.get` | `GET /api/scheduler/timeline` | 将叶子任务从 09:00 起按预计时长串行排列 |
| `tasks.reorder` | `POST /api/scheduler/tasks/reorder` | 依据 `taskIds` 对各节点的直接子节点排序 |
| `stats.get` | `GET /api/scheduler/stats` | 返回完成数、待处理数、进行中数、总预计分钟数和总实际分钟数 |
| `config.get` | `GET /api/scheduler/config` | 返回当前进程加载的 LLM、规划阈值和内存存储说明；不返回 API key |
| `config.update` | `PUT /api/scheduler/config` | 合并请求并返回配置视图；当前不持久化，也不修改进程内 `Settings` |
| `events` | `GET /api/scheduler/events` | 返回一次 `ready` SSE 后结束；当前不是持续业务事件流 |
| `actions.list` | `GET /api/scheduler/actions` | 返回可供 Function bridge 调用的稳定 action 列表 |

当前时间线是展示用顺序结果：日期为 `null`，不处理日历冲突、工作时段或跨日排程。任务的 priority 固定为 `medium`，deadline、scheduled date/time、来源文本和附件不写入内存模型。

## 4. 调试 API 与实时同步

| 接口 | 当前行为 |
| --- | --- |
| `POST /api/v1/tasks/init` | 异步接收 `goal` 和 persona，返回事件 ID |
| `PATCH /api/v1/tasks/{task_id}/status` | 异步提交状态与可选的小时制 `actual_time` |
| `GET /api/v1/tasks/tree` | 返回完整原始任务树；未初始化时返回 404 |
| `WS /ws/tree` | 推送 `NEW_TASK`、`TASK_STATUS_UPDATED`、`TREE_MUTATED`；支持 `scope=all` 或目标节点 ID |

WebSocket 客户端发出文本 `ping` 时服务返回 `{ "type": "pong" }`。节点 scope 仅在事件带有 `target_node_id` 时进行精确过滤，其余事件仍会发送。

## 5. 内置界面

独立 App 和浏览器访问 `/` 使用同一界面，当前可以：

- 输入目标并选择 persona 后初始化计划。
- 查看完整层级任务树及节点预计时长。
- 将叶子节点设置为进行中、完成或阻塞。
- 查看节点数、叶子数、pending 数和 done 数。
- 手动刷新任务树，并在树变更事件后自动刷新。
- 查看最近 30 条 WebSocket 事件及其 payload 摘要。

界面当前不提供任务标题编辑、删除、拖拽排序、配置保存或历史会话恢复；这些 API 行为只能通过 HTTP 调用验证。
