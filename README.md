# AI对抗协议 (AI Adversarial Protocol)

Claude vs OpenAI/Codex — 让AI互相审计、挑刺、通过对抗寻找真相。

## 项目简介

这是一个探索性的AI协作工具，核心思想是：
- **现有multi-agent框架都是"协作导向"** — 让AI们协同完成任务
- **本项目是"对抗导向"** — 让AI互相审计、发现错误、减少幻觉

### 核心功能

✅ **并行调用两个AI** — Claude和OpenAI同时响应
✅ **实时可视化** — SSE streaming展示生成过程
✅ **原生API + 第三方中转双支持** — 灵活的配置系统
✅ **配置优先级** — LocalStorage > .env > 默认值
✅ **Token计数** — 实时显示token使用和成本估算

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置API Keys

复制 `.env.local.example` 为 `.env.local`：

```bash
cp .env.local.example .env.local
```

编辑 `.env.local`，填入你的API keys：

```env
# Claude配置
CLAUDE_API_KEY=sk-ant-xxx
CLAUDE_BASE_URL=https://api.anthropic.com  # 或第三方中转
CLAUDE_MODEL=claude-sonnet-4-20250514

# OpenAI配置
OPENAI_API_KEY=sk-xxx
OPENAI_BASE_URL=https://api.openai.com  # 或第三方中转
OPENAI_MODEL=gpt-4o

# 会话预算限制（美元）
SESSION_BUDGET=5.00
```

### 3. 启动开发服务器

```bash
npm run dev
```

默认优先使用 `5892` 端口；如果该端口已被占用，会自动切换到下一个可用端口并在终端打印出来。

### 4. 访问应用

打开浏览器访问终端里显示的地址，默认通常是：http://localhost:5892

## Day 1-4 完成项

### ✅ 配置自动检测修复（关键更新）
**问题**：API endpoints 使用 Edge runtime，无法访问文件系统读取 ~/.codex/ 和 ~/.claude/ 配置
**解决方案**：
1. **Runtime 修改**：将 `/api/claude` 和 `/api/openai` 从 Edge runtime 改为 Node.js runtime
2. **配置加载优化**：添加 `getEnvOrFallback` 辅助函数，空环境变量不再覆盖自动检测的配置
3. **URL 路径修复**：自动检测的 baseUrl 去掉 `/v1` 后缀（因为 client 会自动添加）
4. **模型名称检测**：从 Codex config.toml 读取模型名称（如 `gpt-5.4`）
5. **Hydration 错误修复**：添加 `mounted` 状态，避免服务器端和客户端配置不一致
6. **唯一 ID 生成**：修复消息 ID 重复问题，添加随机后缀

**测试结果**：
- ✅ Claude API：成功使用 ~/.claude/settings.json 的配置
- ✅ OpenAI API：成功使用 ~/.codex/ 的配置和模型
- ✅ 无 Hydration 错误
- ✅ 无重复 key 警告

### Day 1: 项目设置 + 配置系统
- ✅ Next.js项目初始化
- ✅ TypeScript类型定义 (`lib/types.ts`)
- ✅ 配置管理系统 (`lib/config.ts`)
- ✅ 环境变量模板 (`.env.local.example`)
- ✅ 配置测试页面

### Day 2: API适配层 + 后端
- ✅ Claude API适配器 (`lib/claude-client.ts`)
- ✅ OpenAI API适配器 (`lib/openai-client.ts`)
- ✅ API endpoints (`/api/claude`, `/api/openai`)
- ✅ 并行调用两个API
- ✅ 实时显示streaming响应

### Day 3: 前端UI
- ✅ Zustand状态管理系统 (`lib/store.ts`)
- ✅ 设置面板UI (`components/SettingsPanel.tsx`)
- ✅ 完整UI布局 (`components/MainLayout.tsx`)
  - 左右分屏显示Claude和OpenAI响应
  - 共享转录（完整对话历史）
  - Token计数和成本估算
- ✅ 错误处理
  - API失败→显示错误、禁用面板
  - 超时处理（60秒）
  - Promise.allSettled确保两个API独立失败

### Day 4: 挑战功能 + 持久化 + 测试
- ✅ 手动"挑战"功能 (`components/ChallengeForm.tsx`)
  - 鼠标悬停显示"挑战此回复"按钮
  - 挑战表单（输入原因、保存）
  - 挑战记录面板（显示所有挑战）
- ✅ LocalStorage持久化 (`lib/conversation-store.ts`)
  - 对话历史自动保存
  - 页面刷新后恢复
  - 清空记录功能
  - 导出/导入功能
- ✅ 测试页面 (`/test`)
  - 配置验证测试
  - LocalStorage测试
  - API endpoint可访问性测试
  - 状态管理测试

## 测试清单

### 功能测试
- ✅ 官方API + 第三方中转都能正常工作
- ✅ 两个API并行stream正常
- ✅ API失败时降级到单AI模式
- ✅ 挑战创建和显示正常
- ✅ LocalStorage配置保存和加载正常
- ✅ 对话历史持久化正常
- ✅ Token计数和成本显示准确

### 手动测试步骤
1. **自动检测**：如果机器上已安装 Codex 和 Claude，应用会自动检测配置（无需手动配置）
2. 输入问题，验证两个AI并行响应
3. 测试"挑战此回复"功能
4. 刷新页面，验证对话历史恢复
5. 访问 /config-info 查看配置信息
6. 测试设置面板配置保存（LocalStorage 优先级最高）

## 下一步 (Day 5-6)

- [ ] 部署到Vercel
- [ ] 添加更多测试用例
- [ ] 性能优化（如果需要）
- [ ] 文档完善

## 设计文档

完整的设计文档保存在：
`~/.gstack/projects/default/leo-cy-unknown-design-20260324-231000.md`

## 开源协议

MIT

Built with Claude Code + gstack
