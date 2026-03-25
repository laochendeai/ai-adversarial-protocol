/**
 * Ollama API Client
 * Local AI model integration via Ollama
 * Supports streaming and non-streaming modes
 */

import { ProviderConfig, Message } from './types';

export interface OllamaStreamOptions {
  messages: Message[];
  provider: ProviderConfig;
  onChunk?: (content: string, done: boolean) => void;
  onError?: (error: Error) => void;
  opponentMessage?: Message; // 对方当前轮次的输出（串行模式）
}

export interface OllamaResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * 调用Ollama API（streaming模式）
 */
export async function streamOllamaResponse(
  options: OllamaStreamOptions
): Promise<OllamaResponse> {
  const { messages, provider, onChunk, onError, opponentMessage } = options;

  // 构建API请求
  const baseUrl = provider.baseUrl || 'http://localhost:11434';
  const model = provider.model || 'llama3.2';

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

  // 转换消息格式为Ollama chat格式
  const ollamaMessages = messages.map(m => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content,
  }));

  // Phase 2 - Feature 1: 如果有系统消息，添加到消息列表开头
  if (systemMessage) {
    ollamaMessages.unshift({
      role: 'system',
      content: systemMessage,
    });
  }

  const requestBody = {
    model,
    messages: ollamaMessages,
    stream: true,
  };

  let fullContent = '';
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}\n${errorText}`);
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
        if (line.trim() === '') continue;

        try {
          const parsed = JSON.parse(line);

          // Ollama streaming format
          if (parsed.message?.content) {
            const text = parsed.message.content;
            fullContent += text;
            onChunk?.(text, false);
          }

          // Token计数（Ollama提供prompt_eval_count和eval_count）
          if (parsed.prompt_eval_count !== undefined) {
            inputTokens = parsed.prompt_eval_count;
          }
          if (parsed.eval_count !== undefined) {
            outputTokens = parsed.eval_count;
          }

          // 检查是否完成
          if (parsed.done) {
            onChunk?.('', true);
          }
        } catch (e) {
          // 忽略解析错误
          console.debug('Failed to parse SSE data:', line);
        }
      }
    }

    // 如果stream中没有返回token计数，估算token数
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
 * 调用Ollama API（非streaming模式，用于测试和串行模式）
 */
export async function getOllamaResponse(
  messages: Message[],
  provider: ProviderConfig
): Promise<OllamaResponse> {
  const baseUrl = provider.baseUrl || 'http://localhost:11434';
  const model = provider.model || 'llama3.2';

  const ollamaMessages = messages.map(m => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content,
  }));

  const requestBody = {
    model,
    messages: ollamaMessages,
    stream: false,
  };

  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}\n${errorText}`);
    }

    const data = await response.json();

    if (!data.message) {
      throw new Error('Ollama API returned no message');
    }

    const content = data.message.content || '';

    return {
      content,
      inputTokens: data.prompt_eval_count || 0,
      outputTokens: data.eval_count || 0,
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
 * Local AI通常不需要计算成本（本机运行）
 * 这里返回0，但保留函数以保持接口一致性
 */
export function calculateOllamaCost(inputTokens: number, outputTokens: number): number {
  // Local AI运行在本地，无API调用成本
  return 0;
}
