<!-- 感谢提 PR！请回答下面两个问题，让 reviewer 一眼能 grok。 -->

## Why

<!-- 解决什么问题？什么观察 / 用户反馈 / bug 触发了这个改动？ -->

## What

<!-- 改了哪些核心文件？新增 / 修改 / 删除了什么概念？

特别说明：

- 引入新依赖 → 在这里说明为什么不能复用现有 lib
- 改变事件契约 / API 形状 → 标注是 breaking 还是 backward-compatible
- 涉及多个 surgical commits → 说明每个 commit 的意图  -->

## Test plan

<!-- 选择适用项 -->

- [ ] `npm run type-check` 通过
- [ ] `npm test` 通过
- [ ] `npm run build` 通过
- [ ] 新增/修改的代码有对应测试覆盖
- [ ] 手测过对应场景（说明操作）：

<!-- 如果是 UI/TUI 改动，最好附截图或终端录屏。 -->

## Notes for reviewers

<!-- 你希望 reviewer 重点看哪几个文件？哪些是无脑改动可以略过？ -->

---

<!-- 提交前自检 -->

- [ ] commit message 遵循 [Conventional Commits](https://www.conventionalcommits.org/)
- [ ] 没有把不相关改动揉进同一 commit（surgical commits）
- [ ] 没有提交 `~/.aap/` 配置 / API key / 调试脚本
