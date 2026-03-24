/**
 * Claude API Client
 * 支持原生API和第三方中转
 */

import { ProviderConfig, Message } from './types';

export interface ClaudeStreamOptions {
  messages: Message[];
  provider: ProviderConfig;
  onChunk?: (content: string, done: boolean) => void;
  onError?: (error: Error) => void;
  // Phase 2 - Feature 1: 串行互相引用
  opponentMessage?: Message; // 对方当前轮次的输出（如果是串行模式）
}

export interface ClaudeResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * 调用Claude API（streaming模式）
 */
export async function streamClaudeResponse(
  options: ClaudeStreamOptions
): Promise<ClaudeResponse> {
  const { messages, provider, onChunk, onError, opponentMessage } = options;

  // 构建API请求
  const baseUrl = provider.baseUrl || 'https://api.anthropic.com';
  const model = provider.model || 'claude-sonnet-4-20250514';
  const apiKey = provider.apiKey;

  if (!apiKey) {
    throw new Error('Claude API Key is required');
  }

  // Phase 2 - Feature 1: 如果存在opponentMessage，修改系统提示
  let systemPrompt = '';
  if (opponentMessage) {
    const opponentName = opponentMessage.isClaude === false ? 'OpenAI' : '另一个AI';
    systemPrompt = `
你正在参与一个AI对抗协议。

**重要:** 另一个AI (${opponentName}) 在本轮已经给出了观点。

**对方的观点：**
"""
${opponentMessage.content}
"""

**你的任务：**
1. **仔细阅读对方的观点** — 理解它的核心论点
2. **寻找问题** — 检查是否有事实错误、逻辑漏洞、遗漏要点
3. **礼貌反驳或补充** — 如果发现问题，明确指出；如果没有，表示同意并补充你的视角

**目标：** 找到真相，而不是赢得辩论。如果对方是对的，坦诚承认。
`.trim();
  }

  // 转换消息格式为Claude格式
  const claudeMessages = messages.map(m => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content,
  }));

  const requestBody: any = {
    model,
    messages: claudeMessages,
    stream: true,
    max_tokens: 4096,
  };

  // Phase 2 - Feature 1: 添加系统提示（如果是串行模式）
  if (systemPrompt) {
    requestBody.system = systemPrompt;
  }

  let fullContent = '';
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude API error: ${response.status} ${response.statusText}\n${errorText}`);
    }

    // 处理SSE stream
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);

          if (data === '[DONE]') {
            onChunk?.('', true);
            continue;
          }

          try {
            const parsed = JSON.parse(data);

            // 处理不同类型的stream events
            if (parsed.type === 'message_start') {
              inputTokens = parsed.message.usage.input_tokens;
            } else if (parsed.type === 'message_delta') {
              outputTokens = parsed.usage.output_tokens;
            } else if (parsed.type === 'content_block_delta') {
              if (parsed.delta?.text) {
                const text = parsed.delta.text;
                fullContent += text;
                onChunk?.(text, false);
              }
            }
          } catch (e) {
            // 忽略解析错误
            console.debug('Failed to parse SSE data:', data);
          }
        }
      }
    }

    return {
      content: fullContent,
      inputTokens,
      outputTokens,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    onError?.(err);
    throw err;
  }
}

/**
 * 调用Claude API（非streaming模式，用于测试）
 */
export async function getClaudeResponse(
  messages: Message[],
  provider: ProviderConfig
): Promise<ClaudeResponse> {
  const baseUrl = provider.baseUrl || 'https://api.anthropic.com';
  const model = provider.model || 'claude-sonnet-4-20250514';
  const apiKey = provider.apiKey;

  if (!apiKey) {
    throw new Error('Claude API Key is required');
  }

  const claudeMessages = messages.map(m => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content,
  }));

  const requestBody = {
    model,
    messages: claudeMessages,
    stream: false,
    max_tokens: 4096,
  };

  try {
    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude API error: ${response.status} ${response.statusText}\n${errorText}`);
    }

    const data = await response.json();

    return {
      content: data.content[0]?.text || '',
      inputTokens: data.usage.input_tokens,
      outputTokens: data.usage.output_tokens,
    };
  } catch (error) {
    throw error instanceof Error ? error : new Error(String(error));
  }
}

/**
 * 估算token成本（美元）
 */
export function calculateClaudeCost(inputTokens: number, outputTokens: number): number {
  // Claude Sonnet 4定价 (2025年价格)
  const inputCostPer1k = 0.003;  // $3 per million input tokens
  const outputCostPer1k = 0.015; // $15 per million output tokens

  const inputCost = (inputTokens / 1000) * inputCostPer1k;
  const outputCost = (outputTokens / 1000) * outputCostPer1k;

  return inputCost + outputCost;
}
