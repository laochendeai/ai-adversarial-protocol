/**
 * OpenAI API Client
 * 支持原生API和第三方中转
 */

import { ProviderConfig, Message } from './types';

export interface OpenAIStreamOptions {
  messages: Message[];
  provider: ProviderConfig;
  onChunk?: (content: string, done: boolean) => void;
  onError?: (error: Error) => void;
}

export interface OpenAIResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * 调用OpenAI API（streaming模式）
 */
export async function streamOpenAIResponse(
  options: OpenAIStreamOptions
): Promise<OpenAIResponse> {
  const { messages, provider, onChunk, onError } = options;

  // 构建API请求
  const baseUrl = provider.baseUrl || 'https://api.openai.com';
  const model = provider.model || 'gpt-4o';
  const apiKey = provider.apiKey;

  if (!apiKey) {
    throw new Error('OpenAI API Key is required');
  }

  // 转换消息格式为OpenAI格式
  const openaiMessages = messages.map(m => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content,
  }));

  const requestBody = {
    model,
    messages: openaiMessages,
    stream: true,
    max_tokens: 4096,
  };

  let fullContent = '';
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}\n${errorText}`);
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

            // OpenAI streaming format
            if (parsed.choices && parsed.choices[0]) {
              const delta = parsed.choices[0].delta;

              if (delta?.content) {
                const text = delta.content;
                fullContent += text;
                onChunk?.(text, false);
              }

              // Token计数（有些中转服务不提供）
              if (parsed.usage) {
                inputTokens = parsed.usage.prompt_tokens || 0;
                outputTokens = parsed.usage.completion_tokens || 0;
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
      const estimated = estimateTokens(openaiMessages, fullContent);
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
 * 调用OpenAI API（非streaming模式，用于测试）
 */
export async function getOpenAIResponse(
  messages: Message[],
  provider: ProviderConfig
): Promise<OpenAIResponse> {
  const baseUrl = provider.baseUrl || 'https://api.openai.com';
  const model = provider.model || 'gpt-4o';
  const apiKey = provider.apiKey;

  if (!apiKey) {
    throw new Error('OpenAI API Key is required');
  }

  const openaiMessages = messages.map(m => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content,
  }));

  const requestBody = {
    model,
    messages: openaiMessages,
    stream: false,
    max_tokens: 4096,
  };

  try {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}\n${errorText}`);
    }

    const data = await response.json();

    return {
      content: data.choices[0]?.message?.content || '',
      inputTokens: data.usage?.prompt_tokens || 0,
      outputTokens: data.usage?.completion_tokens || 0,
    };
  } catch (error) {
    throw error instanceof Error ? error : new Error(String(error));
  }
}

/**
 * 粗略估算token数（当API不返回usage时）
 * 英文约4字符/token，中文约1.5字符/token
 */
function estimateTokens(messages: Array<{ content: string }>, response: string): {
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
export function calculateOpenAICost(inputTokens: number, outputTokens: number): number {
  // GPT-4o定价 (2025年价格)
  const inputCostPer1k = 0.0025;  // $2.5 per million input tokens
  const outputCostPer1k = 0.01;  // $10 per million output tokens

  const inputCost = (inputTokens / 1000) * inputCostPer1k;
  const outputCost = (outputTokens / 1000) * outputCostPer1k;

  return inputCost + outputCost;
}
