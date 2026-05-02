/**
 * tool-calling 能力探测
 *
 * 不同上游模型对 OpenAI tool-calling 协议的支持非常不一致：
 *   - 有些原生支持，返回 tool_calls 字段
 *   - 有些不认识 tools 字段，直接给文本答案
 *   - 有些代理把 tools 字段吞掉
 *   - 有些会乱编 tool_calls 但 args 是字符串拼接的乱码
 *
 * 探测策略：发一个必须用 calculate 工具才能完成的小 prompt，
 *          看模型是返回 tool_call 还是直接给文本。
 */

import { ModelConfig } from '@/lib/types';
import { callOpenAIProtocolNonStream } from '@/lib/clients/openai-protocol';
import { ToolDefinition } from '@/lib/tools/types';

const probeTool: ToolDefinition = {
  name: 'calculate',
  description: 'evaluate an arithmetic expression. Always call this tool for any arithmetic; do not answer directly.',
  parameters: {
    type: 'object',
    properties: {
      expression: { type: 'string', description: 'a numeric expression like "7*8"' },
    },
    required: ['expression'],
  },
};

const PROBE_PROMPT =
  '请使用 calculate 工具计算 7 × 8。不要直接回答数字，必须通过工具调用。';

export interface ProbeResult {
  modelId: string;
  supported: boolean;
  reason: string;
  latencyMs: number;
  probedAt: number;
}

export async function probeToolCalling(model: ModelConfig): Promise<ProbeResult> {
  const start = Date.now();
  try {
    const result = await callOpenAIProtocolNonStream(
      model,
      [{ role: 'user', content: PROBE_PROMPT }],
      { maxTokens: 256, tools: [probeTool] }
    );
    const latencyMs = Date.now() - start;

    // 成功判定：模型返回了 tool_calls 且名字匹配
    const calledCalculate = result.toolCalls.some(tc => tc.name === 'calculate');
    if (calledCalculate) {
      return {
        modelId: model.id,
        supported: true,
        reason: 'returned tool_call for calculate',
        latencyMs,
        probedAt: Date.now(),
      };
    }
    // finish_reason 是 tool_calls 但没有有效条目（坏代理）
    if (result.finishReason === 'tool_calls' && result.toolCalls.length === 0) {
      return {
        modelId: model.id,
        supported: false,
        reason: 'finish_reason=tool_calls but no parseable tool_calls payload',
        latencyMs,
        probedAt: Date.now(),
      };
    }
    return {
      modelId: model.id,
      supported: false,
      reason: `returned text content instead of tool_call (finish=${result.finishReason})`,
      latencyMs,
      probedAt: Date.now(),
    };
  } catch (err) {
    return {
      modelId: model.id,
      supported: false,
      reason: `probe failed: ${err instanceof Error ? err.message : String(err)}`,
      latencyMs: Date.now() - start,
      probedAt: Date.now(),
    };
  }
}
