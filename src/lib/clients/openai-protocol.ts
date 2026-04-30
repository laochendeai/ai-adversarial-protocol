/**
 * OpenAI 兼容协议客户端
 * 适用于：OpenAI 官方、各种 OpenAI-compatible 中转、本地多模型端点（如用户的 192.168.0.122）
 */

import { Message, ModelConfig } from '@/lib/types';

export interface StreamCallOptions {
  model: ModelConfig;
  messages: Message[];
  signal?: AbortSignal;
  onDelta?: (delta: string) => void;
  maxTokens?: number;
}

export interface CallResult {
  content: string;
  tokensIn: number;
  tokensOut: number;
}

export async function callOpenAIProtocol(
  options: StreamCallOptions
): Promise<CallResult> {
  const { model, messages, signal, onDelta, maxTokens = 4096 } = options;

  if (!model.apiKey) {
    throw new Error(`Model "${model.id}": API key is required for OpenAI protocol`);
  }

  const baseUrl = model.baseUrl.replace(/\/+$/, '');
  const endpoint = `${baseUrl}/chat/completions`;

  const body = {
    model: model.model,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
    stream: true,
    max_tokens: maxTokens,
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${model.apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `OpenAI protocol error (${model.id}): HTTP ${response.status} ${response.statusText}\n${text}`
    );
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error(`OpenAI protocol error (${model.id}): no response body`);
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';
  let tokensIn = 0;
  let tokensOut = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || !line.startsWith('data: ')) continue;
      const payload = line.slice(6);
      if (payload === '[DONE]') continue;

      try {
        const parsed = JSON.parse(payload);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (typeof delta === 'string' && delta.length > 0) {
          fullContent += delta;
          onDelta?.(delta);
        }
        if (parsed.usage) {
          tokensIn = parsed.usage.prompt_tokens ?? tokensIn;
          tokensOut = parsed.usage.completion_tokens ?? tokensOut;
        }
      } catch {
        // 忽略非 JSON 数据行（如部分中转返回的 keepalive 行）
      }
    }
  }

  if (tokensIn === 0 && tokensOut === 0) {
    const est = estimateTokens(messages, fullContent);
    tokensIn = est.tokensIn;
    tokensOut = est.tokensOut;
  }

  return { content: fullContent, tokensIn, tokensOut };
}

/**
 * 非流式调用（用于挑刺 / 投票等需要完整 JSON 输出的场景）
 */
export async function callOpenAIProtocolNonStream(
  model: ModelConfig,
  messages: Message[],
  options: { signal?: AbortSignal; maxTokens?: number } = {}
): Promise<CallResult> {
  if (!model.apiKey) {
    throw new Error(`Model "${model.id}": API key is required for OpenAI protocol`);
  }

  const baseUrl = model.baseUrl.replace(/\/+$/, '');
  const endpoint = `${baseUrl}/chat/completions`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${model.apiKey}`,
    },
    body: JSON.stringify({
      model: model.model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      stream: false,
      max_tokens: options.maxTokens ?? 4096,
    }),
    signal: options.signal,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `OpenAI protocol error (${model.id}): HTTP ${response.status} ${response.statusText}\n${text}`
    );
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  return {
    content: data.choices?.[0]?.message?.content ?? '',
    tokensIn: data.usage?.prompt_tokens ?? 0,
    tokensOut: data.usage?.completion_tokens ?? 0,
  };
}

function estimateTokens(messages: Message[], output: string) {
  const inputChars = messages.reduce((sum, m) => sum + m.content.length, 0);
  return {
    tokensIn: Math.ceil(inputChars / 2.5),
    tokensOut: Math.ceil(output.length / 2.5),
  };
}
