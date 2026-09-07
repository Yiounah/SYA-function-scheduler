# FocusFlow

FocusFlow 把一个很长的目标拆成阶段，以及你现在就能做的下一步。

## 快速开始（给使用者）

用已经打好的 Mac 安装包，不需要安装 Python 或 Node。

1. 打开 `release/` 里的 `FocusFlow-*.dmg`（或从发布页下载同名安装包）
2. 把 **FocusFlow** 拖进「应用程序」
3. 打开 FocusFlow
4. 写下长程目标，选择规划粒度，点「开始规划」
5. 在路线里把眼前的任务标成进行中、完成或受阻

没有配置模型 Key 时，应用会用内置示例计划，界面和操作流程是完整的。

## 从源码运行（给开发者）

改代码、看最新界面时用这条路径，不要用旧的 `.dmg`。

准备：macOS、[Python 3.11+](https://www.python.org/downloads/)、[Node.js](https://nodejs.org/)。

```bash
git clone https://github.com/Yiounah/SYA-function-scheduler.git
cd SYA-function-scheduler

python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
npm install
npm run app:dev
```

- `npm run app:dev`：开发模式，直接打开当前源码。改完再运行一次即可看到更新。
- `npm run app:dist:mac`：打包模式，生成别人也能安装的 `release/*.dmg`。包里是打包那一刻的代码，之后改源码要重新打包。

要用 GLM-5.3 做真正拆解时：到 [智谱开放平台](https://bigmodel.cn/usercenter/proj-mgmt/apikeys) 创建 Key，填进 `.env` 的 `SYA_OPENAI_API_KEY=`，然后重新运行 `npm run app:dev`。
