/**
 * 自动挑刺Prompt生成器
 * Auto-Challenge Prompt Generator
 */

import { Message } from '@/lib/types';

/**
 * 生成自动挑刺的prompt
 */
export function generateAutoChallengePrompt(
  targetOutput: string,
  targetAi: 'claude' | 'openai'
): string {
  const targetName = targetAi === 'claude' ? 'Claude' : 'OpenAI';

  return `
你正在审计另一个AI (${targetName}) 的输出。你的任务是找到其中的问题。

**对方的输出：**
"""
${targetOutput}
"""

**审计维度：**
1. **事实错误** — 引用了不存在的事实、数据错误、常识错误
2. **逻辑漏洞** — 推理过程有问题、前后矛盾、因果倒置
3. **重要遗漏** — 遗漏了关键信息、忽略了重要的反例
4. **表述不清** — 概念模糊、术语使用不当、容易引起误解

**输出格式 (JSON):**
请只输出JSON，不要有其他内容：
\`\`\`json
{
  "challenges": [
    {
      "type": "factual-error" | "logical-flaw" | "omission" | "unclear" | "other",
      "severity": "low" | "medium" | "high",
      "targetSegment": "被挑刺的具体文本（50字以内）",
      "reason": "挑刺原因（100字以内）",
      "confidence": 0.0-1.0
    }
  ]
}
\`\`\`

**重要：**
- 只挑刺你**确信**有问题的地方（confidence > 0.7）
- 不要为了挑刺而挑刺
- 如果对方回答得很好，返回空数组：{"challenges": []}
- 必须输出有效的JSON格式
`.trim();
}

/**
 * 生成结构化挑刺prompt（用于function calling）
 */
export function generateStructuredChallengePrompt(
  targetOutput: string,
  targetAi: 'claude' | 'openai'
): string {
  const targetName = targetAi === 'claude' ? 'Claude' : 'OpenAI';

  return `
你正在审计另一个AI (${targetName}) 的输出。

**对方的输出：**
"""
${targetOutput}
"""

**你的任务：** 找出对方输出中的问题（事实错误、逻辑漏洞、遗漏、不清）。

**挑刺类型：**
- factual-error: 事实错误
- logical-flaw: 逻辑漏洞
- omission: 重要遗漏
- unclear: 表述不清
- other: 其他问题

**严重性：**
- high: 严重问题，影响答案正确性
- medium: 中等问题，但不影响整体
- low: 轻微问题，可改进之处

**要求：**
- 只挑刺confidence > 0.7的问题
- 如果没有发现问题，返回空数组
- targetSegment要简洁（50字以内）
- reason要具体（100字以内）
`.trim();
}
