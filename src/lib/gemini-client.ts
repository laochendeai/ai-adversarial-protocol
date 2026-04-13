/**
 * Gemini API Client
 * Google AI Studio API integration
 * Supports streaming and non-streaming modes
 */

import { ProviderConfig, Message } from './types';

export interface GeminiStreamOptions {
  messages: Message[];
  provider: ProviderConfig;
  onChunk?: (content: string, done: boolean) => void;
  onError?: (error: Error) => void;
  opponentMessage?: Message; // 对方当前轮次的输出（串行模式）
}

export interface GeminiResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * 调用Gemini API（streaming模式）
 */
export async function streamGeminiResponse(
  options: GeminiStreamOptions
): Promise<GeminiResponse> {
  const { messages, provider, onChunk, onError, opponentMessage } = options;

  // 构建API请求
  const baseUrl = provider.baseUrl || 'https://generativelanguage.googleapis.com';
  const model = provider.model || 'gemini-pro';
  const apiKey = provider.apiKey;

  if (!apiKey) {
    throw new Error('Gemini API Key is required');
  }

  // Phase 2 - Feature 1: 如果存在opponentMessage，添加系统消息
  let systemMessage = '';
  if (opponentMessage) {
    const opponentName = opponentMessage.isClaude === true ? 'Claude' : '另一个AI';
    systemMessage = `
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

  // 转换消息格式为Gemini格式
  const geminiMessages = messages.map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }));

  // Phase 2 - Feature 1: 如果有系统消息，添加到消息列表开头
  if (systemMessage) {
    geminiMessages.unshift({
      role: 'user',
      parts: [{ text: systemMessage }],
    });
  }

  const requestBody = {
    contents: geminiMessages,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 4096,
      candidateCount: 1,
    },
  };

  let fullContent = '';
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    const response = await fetch(
      `${baseUrl}/v1beta/models/${model}:streamGenerateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}\n${errorText}`);
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
          const data = line.slice(6).trim();

          if (data === '[DONE]') {
            onChunk?.('', true);
            continue;
          }

          try {
            const parsed = JSON.parse(data);

            // Gemini streaming format
            if (parsed.candidates && parsed.candidates[0]) {
              const candidate = parsed.candidates[0];

              if (candidate.content?.parts) {
                for (const part of candidate.content.parts) {
                  if (part.text) {
                    const text = part.text;
                    fullContent += text;
                    onChunk?.(text, false);
                  }
                }
              }

              // Token计数（Gemini提供usage信息）
              if (candidate.usageMetadata) {
                inputTokens = candidate.usageMetadata.promptTokenCount || 0;
                outputTokens = candidate.usageMetadata.candidatesTokenCount || 0;
              }
            }
          } catch (e) {
            // 忽略解析错误
            console.debug('Failed to parse SSE data:', data);
          }
        }
      }
    }

    // 如果stream中没有返回usage，估算token数
    if (inputTokens === 0 && outputTokens === 0) {
      const estimated = estimateTokens(messages, fullContent);
      inputTokens = estimated.inputTokens;
      outputTokens = estimated.outputTokens;
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
 * 调用Gemini API（非streaming模式，用于测试和串行模式）
 */
export async function getGeminiResponse(
  messages: Message[],
  provider: ProviderConfig
): Promise<GeminiResponse> {
  const baseUrl = provider.baseUrl || 'https://generativelanguage.googleapis.com';
  const model = provider.model || 'gemini-pro';
  const apiKey = provider.apiKey;

  if (!apiKey) {
    throw new Error('Gemini API Key is required');
  }

  const geminiMessages = messages.map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }));

  const requestBody = {
    contents: geminiMessages,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 4096,
      candidateCount: 1,
    },
  };

  try {
    const response = await fetch(
      `${baseUrl}/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}\n${errorText}`);
    }

    const data = await response.json();

    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('Gemini API returned no candidates');
    }

    const candidate = data.candidates[0];
    let content = '';

    if (candidate.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.text) {
          content += part.text;
        }
      }
    }

    return {
      content,
      inputTokens: candidate.usageMetadata?.promptTokenCount || 0,
      outputTokens: candidate.usageMetadata?.candidatesTokenCount || 0,
    };
  } catch (error) {
    throw error instanceof Error ? error : new Error(String(error));
  }
}

/**
 * 估算token数（当API不返回usage时）
 * 英文约4字符/token，中文约1.5字符/token
 */
function estimateTokens(messages: Message[], response: string): {
  inputTokens: number;
  outputTokens: number;
} {
  let inputChars = 0;

  for (const msg of messages) {
    inputChars += msg.content.length;
  }

  // 估算：平均2.5字符/token
  const inputTokens = Math.ceil(inputChars / 2.5);
  const outputTokens = Math.ceil(response.length / 2.5);

  return { inputTokens, outputTokens };
}

/**
 * 估算token成本（美元）
 */
export function calculateGeminiCost(inputTokens: number, outputTokens: number): number {
  // Gemini Pro定价（2025年价格）
  // https://ai.google.dev/pricing
  const inputCostPer1M = 0.50;  // $0.50 per million input tokens
  const outputCostPer1M = 1.50;  // $1.50 per million output tokens

  const inputCost = (inputTokens / 1_000_000) * inputCostPer1M;
  const outputCost = (outputTokens / 1_000_000) * outputCostPer1M;

  return inputCost + outputCost;
}
