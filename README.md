# AI 对抗协议 (aap)

> 让多个 LLM 围绕同一个问题互相挑刺、投票，得到比单模型更可信的答案。CLI 工具 + OpenAI/Anthropic 兼容的 HTTP 服务，单进程同时跑。

[![CI](https://github.com/leo-cy/ai-adversarial-protocol/workflows/CI/badge.svg)](https://github.com/leo-cy/ai-adversarial-protocol/actions/workflows/ci.yml)

## 这是什么

`aap` 是一个 Node.js CLI，把任意数量、任意协议（OpenAI / Anthropic / Ollama）的模型放在一起做三阶段对抗：

1. **生成 (generating)** — 所有选中模型并行回答同一个问题
2. **互相挑刺 (auto-challenge)** — 每个模型审计其它模型的输出，标注事实错误、逻辑漏洞、遗漏点
3. **投票 (voting)** — 每个模型给所有答案打分，按权重/共识算出获胜方

所有过程都通过 EventEmitter 实时输出。一个进程内同时跑两个前端：

- **TUI**：基于 ink 的终端界面，实时看到每个模型的流式输出和挑刺/投票结果
- **HTTP Server**：兼容 OpenAI `/v1/chat/completions` 和 Anthropic `/v1/messages`，外部 agent（Claude Code、Cursor、自研 agent）可以直接调它，TUI 也会同时看到这些外部触发的 run

## 架构

```
┌─────────────────── aap 进程 ───────────────────┐
│                                                │
│   TUI (ink)          HTTP Server (Hono)        │
│      ↑                    ↑                    │
│      └────── EngineHub ───┘  ← 全局事件总线     │
│                  ↓                              │
│        AdversarialEngine (per-run)              │
│                  ↓                              │
│        ModelClient (协议分发)                   │
│           ↓        ↓        ↓                   │
│        OpenAI  Anthropic  Ollama                │
└────────────────────────────────────────────────┘
```

`EngineHub` 是单例事件总线：TUI 输入和 HTTP 请求都通过它创建 run，所有事件被 TUI 渲染、被 SSE 转发。

## 快速开始

### 安装

```bash
npm install
npm run build           # 构建 dist/cli.js
npm link                # 全局可用 aap 命令（可选）
```

或开发模式直接跑：`npm run dev`（等于 `tsx src/cli.ts`）。

### 配置模型

配置文件在 `~/.aap/config.json`。第一次跑会自动创建空的：

```bash
aap config init
```

添加模型（用户的本地多模型端点示例）：

```bash
aap config add deepseek-v3 \
  --protocol openai \
  --base-url http://192.168.0.122:20128/v1 \
  --api-key sk-xxx \
  --model deepseek-ai/DeepSeek-V3.2

aap config add qwen-235b \
  --protocol openai \
  --base-url http://192.168.0.122:20128/v1 \
  --api-key sk-xxx \
  --model Qwen/Qwen3-235B-A22B-Instruct-2507

aap config add claude-haiku \
  --protocol anthropic \
  --base-url https://api.anthropic.com \
  --api-key sk-ant-xxx \
  --model claude-haiku-4-5

aap config list
```

每个模型可设置 `--weight <n>` 用于加权投票，加 `--disabled` 暂时禁用。

### 启动

```bash
aap                     # 默认：TUI + Server 同时启动
aap --no-tui            # headless：只跑 Server（部署用）
aap --no-server         # 只跑 TUI（本地调试）
aap --port 9000         # 指定端口（默认 8788）
aap --host 0.0.0.0      # 监听所有网卡
```

## TUI 操作

| 键 | 动作 |
|---|---|
| `↑` / `↓` | 在 run 列表里切换 |
| `n` | 新建对抗（先选模型，再输入问题） |
| `q` / `Ctrl+C` | 退出 |

`n` 弹出的窗口里：空格切换模型勾选，Enter 进入问题输入，再按 Enter 触发对抗。

每个 run 会显示：
- 三阶段进度条（generating → auto-challenge → voting）
- 每个模型的流式输出、token 数、耗时
- 互相挑刺的详情（类型/严重性/置信度/原文片段/理由）
- 投票结果（获胜方、共识度、各模型投票分布）

外部 HTTP 请求触发的 run 也会出现在列表里，标记为 `http-openai` 或 `http-anthropic`。

## HTTP API

服务监听 `http://127.0.0.1:8788`（默认）。`model` 字段决定行为：

| `model` 值 | 行为 |
|---|---|
| `adversarial:all` | 调用所有 enabled 模型，并行返回（带挑刺） |
| `adversarial:vote` | 全部模型 + 投票，主响应是获胜方答案 |
| `adversarial:debate` | 全部模型 + 挑刺，主响应是合并的多模型输出 |
| `adversarial:m1,m2,m3` | 指定参与的模型 id |
| `qwen-235b` | 直接透传，不做对抗 |

### OpenAI 兼容

```bash
curl -X POST http://127.0.0.1:8788/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "adversarial:vote",
    "messages": [{"role":"user","content":"用一句话解释熵"}]
  }'
```

响应是标准 OpenAI Chat Completion 格式，多了一个 `x_adversarial` 扩展字段：

```jsonc
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "model": "adversarial:vote",
  "choices": [{
    "index": 0,
    "message": { "role": "assistant", "content": "<获胜方的回答>" },
    "finish_reason": "stop"
  }],
  "usage": { "prompt_tokens": 4030, "completion_tokens": 108, "total_tokens": 4138 },
  "x_adversarial": {
    "runId": "...",
    "mode": "vote",
    "responses": [
      { "modelId": "deepseek-v3", "content": "...", "tokensOut": 49, "durationMs": 5598 },
      { "modelId": "qwen-235b",   "content": "...", "tokensOut": 59, "durationMs": 4650 }
    ],
    "challenges": [{ "challengerId": "qwen-235b", "targetId": "deepseek-v3", "type": "...", "severity": "high", "reason": "...", "confidence": 0.95 }],
    "voting": { "winnerId": "deepseek-v3", "consensusLevel": 1.0, "isUnanimous": true, "votes": [...] }
  }
}
```

流式：加 `"stream": true`，按标准 OpenAI SSE 输出，每个模型用 `## modelId` markdown header 分隔；最后一个 chunk 携带 `x_adversarial`，再发 `data: [DONE]`。

`GET /v1/models` 列出所有 `adversarial:*` 虚拟模型 + 配置中的真实模型 id。

### Anthropic 兼容

```bash
curl -X POST http://127.0.0.1:8788/v1/messages \
  -H "Content-Type: application/json" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "adversarial:debate",
    "max_tokens": 1024,
    "messages": [{"role":"user","content":"1+1=?"}]
  }'
```

返回标准 Anthropic Message 格式（`type: "message"`, `content: [{type:"text",...}]`），同样带 `x_adversarial` 字段。流式遵循 Anthropic 的 `message_start` / `content_block_delta` / `message_delta` / `message_stop` 事件协议。

### 接入 Claude Code

把 Claude Code 的 endpoint 指过来，所有对话都会走对抗协议：

```bash
export ANTHROPIC_BASE_URL=http://127.0.0.1:8788
export ANTHROPIC_AUTH_TOKEN=any
claude
```

或在 `~/.claude/settings.json` 里写死。同时打开 `aap` 的 TUI，可以实时看到 Claude Code 每次请求被多模型对抗的过程。

### 接入 OpenAI SDK

```python
from openai import OpenAI
client = OpenAI(base_url="http://127.0.0.1:8788/v1", api_key="any")
resp = client.chat.completions.create(
    model="adversarial:vote",
    messages=[{"role":"user","content":"hi"}],
)
print(resp.choices[0].message.content)
print(resp.model_extra["x_adversarial"]["voting"])
```

## 配置子命令

```
aap config init                  # 初始化空配置
aap config list                  # 列出所有模型
aap config add <id> ...          # 添加模型
aap config remove <id>           # 删除
aap config enable <id>           # 启用
aap config disable <id>          # 禁用
aap config path                  # 打印配置文件路径
```

## 持久化

`~/.aap/`：
- `config.json` — 模型 + 服务器配置
- `audit-metrics.json` — 每个模型的累计可靠性评分（A+ ~ D）

## 项目结构

```
src/
├── cli.ts                     # commander CLI 入口
├── config/loader.ts           # ~/.aap/config.json 读写
├── engine/
│   ├── AdversarialEngine.ts   # 单次对抗（EventEmitter）
│   ├── EngineHub.ts           # 全局事件总线
│   └── ModelClient.ts         # 协议分发
├── lib/
│   ├── clients/               # openai / anthropic / ollama 协议实现
│   ├── features/              # voting / auto-challenge / audit-metrics / thinking-vis
│   └── types.ts
├── server/
│   ├── index.ts               # Hono 服务启动
│   ├── sse.ts                 # SSE 流转换
│   └── routes/                # openai-compat / anthropic-compat
└── tui/
    ├── App.tsx                # ink 顶层
    ├── hooks/useHub.ts        # 订阅 EngineHub
    └── components/            # RunListPanel / RunDetailView / ModelPanel / ...
```

## 开发

```bash
npm run dev              # tsx src/cli.ts（直接跑源码）
npm run build            # tsup 打包到 dist/cli.js
npm run type-check       # tsc --noEmit
npm test                 # vitest --run
```

构建产物是单个 ~83 KB 的 ESM 文件 + sourcemap，运行时只依赖 `react/ink/ink-*`（external）。

## 许可

MIT
