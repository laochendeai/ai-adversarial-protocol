/**
 * 投票Prompt生成器
 * Voting Prompt Generator
 */

import { VotingRequest, VoteTopic, AIProvider } from '@/lib/types';

/**
 * 生成投票prompt
 */
export function generateVotingPrompt(
  request: VotingRequest,
  voterId: AIProvider
): string {
  const { messages, topic, context, config } = request;

  let prompt = `你正在参与一个AI投票系统，用于评估不同AI的回答质量。\n\n`;

  // 添加上下文
  if (context) {
    prompt += `**原始问题:**\n${context}\n\n`;
  }

  // 添加任务描述
  prompt += `**投票任务:** ${topic.description}\n\n`;

  // 添加候选答案
  prompt += `**候选答案:**\n\n`;
  messages.forEach((msg, idx) => {
    const aiName = msg.isClaude === undefined ? '未知' : (msg.isClaude ? 'Claude' : 'OpenAI');
    prompt += `选项 ${msg.id} (${aiName}):\n`;
    prompt += `"${msg.content.substring(0, 500)}${msg.content.length > 500 ? '...' : ''}"\n\n`;
  });

  // 添加投票指令
  prompt += `**投票要求:**\n`;
  prompt += `1. 从以上候选答案中选择你认为最好的一个\n`;
  prompt += `2. 选择标准：准确性、完整性、逻辑性、清晰度\n`;
  if (config?.mode === 'expert-weighted' && config.expertProvider) {
    prompt += `3. 当前为 expert-weighted 模式，专家 AI (${config.expertProvider}) 的投票权重为其基础权重的 3 倍\n`;
    prompt += `4. 必须返回有效的JSON格式\n\n`;
  } else {
    prompt += `3. 必须返回有效的JSON格式\n\n`;
  }

  prompt += `**输出格式:**\n`;
  prompt += `{\n`;
  prompt += `  "choice": "消息ID（从选项中选择一个）",\n`;
  prompt += `  "confidence": 0.0-1.0之间的置信度,\n`;
  prompt += `  "reasoning": "简短的投票理由（50字以内）"\n`;
  prompt += `}\n`;

  return prompt;
}

/**
 * 生成事实核查投票prompt
 */
export function generateFactCheckPrompt(
  statement: string,
  context?: string
): string {
  let prompt = `你正在参与一个AI事实核查投票系统。\n\n`;

  if (context) {
    prompt += `**背景:**\n${context}\n\n`;
  }

  prompt += `**待核查陈述:**\n"${statement}"\n\n`;
  prompt += `**投票要求:**\n`;
  prompt += `1. 判断该陈述是否正确\n`;
  prompt += `2. 考虑事实准确性、逻辑合理性、有无明显错误\n`;
  prompt += `3. 返回有效的JSON格式\n\n`;

  prompt += `**输出格式:**\n`;
  prompt += `{\n`;
  prompt += `  "choice": "correct" | "incorrect" | "uncertain",\n`;
  prompt += `  "confidence": 0.0-1.0,\n`;
  prompt += `  "reasoning": "简短理由（50字以内）"\n`;
  prompt += `}\n`;

  return prompt;
}

/**
 * 生成挑刺验证投票prompt
 */
export function generateChallengeValidationPrompt(
  originalMessage: string,
  challenge: string,
  challengeType: string
): string {
  let prompt = `你正在评估一个AI挑刺是否合理。\n\n`;

  prompt += `**原始回答:**\n"${originalMessage.substring(0, 300)}..."\n\n`;
  prompt += `**挑刺内容:**\n"${challenge}"\n`;
  prompt += `**挑刺类型:** ${challengeType}\n\n`;

  prompt += `**评估要求:**\n`;
  prompt += `1. 判断该挑刺是否合理、准确、有价值\n`;
  prompt += `2. 考虑挑刺的事实基础、逻辑性、重要性\n`;
  prompt += `3. 返回有效的JSON格式\n\n`;

  prompt += `**输出格式:**\n`;
  prompt += `{\n`;
  prompt += `  "choice": "accept" | "reject" | "neutral",\n`;
  prompt += `  "confidence": 0.0-1.0,\n`;
  prompt += `  "reasoning": "简短理由（50字以内）"\n`;
  prompt += `}\n`;

  return prompt;
}

/**
 * 解析投票响应
 * @param options - Valid option IDs to validate against (optional, for validation)
 */
export function parseVotingResponse(
  response: string,
  voterId: AIProvider,
  topicId: string,
  options?: string[]  // 添加选项列表用于验证
): { choice?: string; confidence?: number; reasoning?: string } | null {
  try {
    // 尝试提取JSON
    let jsonStr = response;

    // 如果响应包含markdown代码块，提取其中内容
    const jsonMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    } else {
      // 尝试直接查找JSON对象
      const objectMatch = response.match(/\{[\s\S]*?\}/);
      if (objectMatch) {
        jsonStr = objectMatch[0];
      }
    }

    const parsed = JSON.parse(jsonStr);

    // 验证choice是否在有效选项中（如果提供了选项列表）
    if (parsed.choice && options && !options.includes(parsed.choice)) {
      console.error(`Invalid choice "${parsed.choice}" not in options:`, options);
      return null;
    }

    return {
      choice: parsed.choice,
      confidence: parsed.confidence,
      reasoning: parsed.reasoning,
    };
  } catch (error) {
    console.error('Failed to parse voting response:', error);
    return null;
  }
}
