# CI/CD Status

## GitHub Actions 工作流

### 工作流文件
`.github/workflows/ci.yml`

### 触发条件
- Push 到 `main` 分支
- Pull Request 到 `main` 分支

### CI 检查项目

#### 1. Type Check & Lint (类型检查和代码规范)
- ✅ TypeScript 类型检查 (`npm run type-check`)
- ⚠️ ESLint 代码检查 (`npm run lint` - 非阻塞)

#### 2. Tests (测试)
- ✅ 运行所有测试 (`npm run test -- --run`)
- ✅ 生成覆盖率报告 (`npm run test:coverage`)

### CI 徽章
在 README.md 中显示 CI 状态：
```markdown
[![CI](https://github.com/leo-cy/ai-adversarial-protocol/workflows/CI/badge.svg)]
```

### 本地运行 CI 检查

在推送代码之前，您可以本地运行相同的检查：

```bash
# 类型检查
npm run type-check

# 代码规范检查
npm run lint

# 运行所有测试
npm run test -- --run

# 生成覆盖率报告
npm run test:coverage
```

### CI 状态说明

- ✅ **通过**: 所有检查通过，代码可以合并
- ⚠️ **警告**: 非关键检查失败（如 ESLint 警告），可以合并但建议修复
- ❌ **失败**: 关键检查失败（如类型错误、测试失败），需要修复后才能合并

### 下一步优化建议

1. **修复 ESLint 问题**: 当前有 58 个错误和 60 个警告
   - 优先修复错误（`@typescript-eslint/no-explicit-any`）
   - 可以逐步修复警告

2. **增加覆盖率目标**: 当前覆盖率良好，可以设置最低覆盖率阈值

3. **添加更多检查**:
   - 依赖安全扫描 (`npm audit`)
   - Bundle 大小监控
   - 性能回归测试

### CI 不包含的内容

- ❌ 自动部署到 Vercel（按照用户要求不包含）
- ❌ E2E 测试（使用 Playwright，未来可以添加）
- ❌ 性能基准测试（可以添加）

## 最近 CI 运行

查看最新的 CI 运行状态：
https://github.com/leo-cy/ai-adversarial-protocol/actions
