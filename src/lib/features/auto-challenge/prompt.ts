/**
 * 自动挑刺 prompt 生成器（通用化）
 */

export interface AutoChallengePromptInput {
  targetContent: string;
  targetDisplayName: string;       // 被挑刺模型的显示名
}

export function generateAutoChallengePrompt(input: AutoChallengePromptInput): string {
  return `
你正在审计另一个 AI 模型 (${input.targetDisplayName}) 的输出。你的任务是找到其中的问题。

**对方的输出：**
"""
${input.targetContent}
"""

**审计维度：**
1. **事实错误 (factual-error)** — 引用了不存在的事实、数据错误、常识错误
2. **逻辑漏洞 (logical-flaw)** — 推理过程有问题、前后矛盾、因果倒置
3. **重要遗漏 (omission)** — 遗漏了关键信息、忽略了重要的反例
4. **表述不清 (unclear)** — 概念模糊、术语使用不当、容易引起误解
5. **其他 (other)** — 不属于以上类别但仍有问题的情况

**输出格式（仅 JSON，不要解释）：**
\`\`\`json
{
  "challenges": [
    {
      "type": "factual-error" | "logical-flaw" | "omission" | "unclear" | "other",
      "severity": "low" | "medium" | "high",
      "targetSegment": "被挑刺的具体文本，50字以内",
      "reason": "挑刺原因，100字以内",
      "confidence": 0.0-1.0
    }
  ]
}
\`\`\`

**重要规则：**
- 只挑刺你**确信**有问题的地方（confidence > 0.7）
- 不要为了挑刺而挑刺
- 如果对方回答得很好，返回空数组：\`{"challenges": []}\`
- 必须输出有效的 JSON 格式
`.trim();
}
