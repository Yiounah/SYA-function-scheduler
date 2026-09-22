# FocusFlow

FocusFlow 把一个很长的目标拆成阶段，以及你现在就能做的下一步。

## 快速开始（给使用者）

用已经打好的 Mac 安装包，不需要安装 Python 或 Node。

1. 打开 `release/` 里的 `FocusFlow-*.dmg`（或从发布页下载同名安装包）
2. 把 **FocusFlow** 拖进「应用程序」
3. 打开 FocusFlow
4. 点「新建规划」，写下长程目标，选择规划粒度，生成研究时间轴
5. 在时间轴里选择阶段，把眼前的清单标成进行中或完成

没有配置模型 Key 时，应用会用内置示例计划，界面和操作流程是完整的。

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

要用 GLM-5.3 做真正拆解时：到 [智谱开放平台](https://bigmodel.cn/usercenter/proj-mgmt/apikeys) 创建 Key，填进 `.env` 的 `SYA_OPENAI_API_KEY=`，然后重新运行 `npm run app:dev`。

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

