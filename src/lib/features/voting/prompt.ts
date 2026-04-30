/**
 * 投票 Prompt 生成器（通用化版本）
 */

import { ModelResponse, ModelConfig } from '@/lib/types';

export interface VotingPromptInput {
  question: string;
  candidates: ModelResponse[];     // 候选答案
  candidateModels: Map<string, ModelConfig>;  // modelId → ModelConfig（用于显示名）
}

export function generateVotingPrompt(input: VotingPromptInput): string {
  const { question, candidates, candidateModels } = input;

  let prompt = `你正在参与一个 AI 投票系统，从多个候选答案中选出最优的一个。\n\n`;
  prompt += `**原始问题:**\n${question}\n\n`;
  prompt += `**候选答案:**\n\n`;

  candidates.forEach(c => {
    const display = candidateModels.get(c.modelId)?.id ?? c.modelId;
    const truncated = c.content.length > 800 ? c.content.slice(0, 800) + '...' : c.content;
    prompt += `选项 \`${c.modelId}\` (${display}):\n"""\n${truncated}\n"""\n\n`;
  });

  prompt += `**投票要求:**\n`;
  prompt += `1. 从以上候选选项中选择你认为最好的一个\n`;
  prompt += `2. 评判标准：准确性、完整性、逻辑性、清晰度\n`;
  prompt += `3. 必须返回有效的 JSON 格式\n\n`;
  prompt += `**输出格式（仅 JSON，不要解释）:**\n`;
  prompt += '```json\n';
  prompt += `{\n`;
  prompt += `  "choice": "<上面列出的选项 ID>",\n`;
  prompt += `  "confidence": 0.0-1.0,\n`;
  prompt += `  "reasoning": "简短理由，50字以内"\n`;
  prompt += `}\n`;
  prompt += '```\n';

  return prompt;
}

export function parseVotingResponse(
  response: string,
  validChoices: string[]
): { choice: string; confidence: number; reasoning?: string } | null {
  let jsonStr = response;
  const fenced = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (fenced) {
    jsonStr = fenced[1];
  } else {
    const obj = response.match(/\{[\s\S]*?\}/);
    if (obj) jsonStr = obj[0];
  }

  try {
    const parsed = JSON.parse(jsonStr);
    if (typeof parsed.choice !== 'string') return null;
    if (!validChoices.includes(parsed.choice)) return null;

    const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.5;
    return {
      choice: parsed.choice,
      confidence: Math.max(0, Math.min(1, confidence)),
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : undefined,
    };
  } catch {
    return null;
  }
}
