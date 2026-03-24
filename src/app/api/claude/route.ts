/**
 * Claude API Endpoint
 * 支持SSE streaming
 */

import { NextRequest } from 'next/server';
import { streamClaudeResponse } from '@/lib/claude-client';
import { Message, ProviderConfig } from '@/lib/types';
import { getServerConfig } from '@/lib/config';

export const runtime = 'nodejs'; // 使用Node.js runtime以支持文件系统访问（自动检测配置）

interface ChatRequestBody {
  question: string;
  debateState: {
    messages: Message[];
  };
  provider?: Partial<ProviderConfig>; // 可选的provider覆盖
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequestBody = await request.json();
    const { question, debateState, provider: providerOverride } = body;

    if (!question) {
      return new Response(JSON.stringify({ error: 'Question is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 构建消息历史
    const messages: Message[] = [
      ...debateState.messages,
      {
        id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        role: 'user',
        content: question,
        timestamp: Date.now(),
      },
    ];

    // 获取配置（优先使用provider覆盖）
    const serverConfig = getServerConfig();
    const provider: ProviderConfig = providerOverride
      ? { ...serverConfig.claude, ...providerOverride }
      : serverConfig.claude;

    // 验证API key
    if (!provider.apiKey) {
      return new Response(
        JSON.stringify({
          error: 'Claude API Key not configured. Please set CLAUDE_API_KEY in .env.local',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // 创建SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          await streamClaudeResponse({
            messages,
            provider,
            onChunk: (content, done) => {
              const data = JSON.stringify({
                id: `claude-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                content,
                isClaude: true,
                done,
                timestamp: Date.now(),
              });

              controller.enqueue(encoder.encode(`data: ${data}\n\n`));

              if (done) {
                controller.close();
              }
            },
            onError: (error) => {
              const errorData = JSON.stringify({
                error: error.message,
                isClaude: true,
                timestamp: Date.now(),
              });
              controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
              controller.close();
            },
          });
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          const errorData = JSON.stringify({
            error: err.message,
            isClaude: true,
            timestamp: Date.now(),
          });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
