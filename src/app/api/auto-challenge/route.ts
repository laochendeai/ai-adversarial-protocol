/**
 * 自动挑刺 API
 * Auto-Challenge API Endpoint
 *
 * POST /api/auto-challenge
 *
 * AI自动检测对方输出中的问题
 */

import { NextRequest, NextResponse } from 'next/server';
import { Message, AutoChallengeConfig, Challenge } from '@/lib/types';
import { generateAutoChallengePrompt } from '@/lib/features/auto-challenge';
import { parseChallengeResponse, deduplicateChallenges, limitChallenges, filterValidChallenges, calculateChallengeSummary } from '@/lib/features/auto-challenge/parser';
import { getServerConfig } from '@/lib/config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messageA, messageB, config }: {
      messageA: Message;
      messageB: Message;
      config: AutoChallengeConfig;
    } = body;

    // 检查是否启用自动挑刺
    if (!config.enabled) {
      return NextResponse.json({
        success: false,
        error: 'Auto-challenge is not enabled',
      });
    }

    console.log('=== Auto-Challenge Started ===');
    console.log('Message A (Claude):', messageA.id);
    console.log('Message B (OpenAI):', messageB.id);

    const allChallenges: Challenge[] = [];
    const errors: string[] = [];

    // 并行调用两个AI进行互相挑刺
    const challenges = await Promise.allSettled([
      // Claude审计OpenAI
      auditMessage(messageB, messageA, 'claude', config),
      // OpenAI审计Claude
      auditMessage(messageA, messageB, 'openai', config),
    ]);

    // 处理结果
    challenges.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        allChallenges.push(...result.value);
      } else {
        const ai = index === 0 ? 'claude' : 'openai';
        errors.push(`${ai} challenge failed: ${result.reason}`);
        console.error(`${ai} challenge error:`, result.reason);
      }
    });

    // 去重
    const deduplicated = deduplicateChallenges(allChallenges);

    // 验证
    const validated = filterValidChallenges(deduplicated);

    // 限制数量
    const limited = limitChallenges(validated, config.maxChallengesPerRound);

    // 计算统计
    const summary = calculateChallengeSummary(limited);

    console.log('=== Auto-Challenge Completed ===');
    console.log('Total challenges:', limited.length);
    console.log('Summary:', summary);

    return NextResponse.json({
      success: true,
      data: {
        challenges: limited,
        summary,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error) {
    console.error('Auto-challenge error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * 让一个AI审计另一个AI的输出
 */
async function auditMessage(
  targetMessage: Message,
  challengerMessage: Message,
  challengerAi: 'claude' | 'openai',
  config: AutoChallengeConfig
): Promise<Challenge[]> {
  const serverConfig = getServerConfig();
  const provider = challengerAi === 'claude' ? serverConfig.claude : serverConfig.openai;

  // 生成prompt
  const prompt = generateAutoChallengePrompt(targetMessage.content, targetMessage.isClaude === true ? 'claude' : 'openai');

  // 构建消息
  const messages = [
    {
      id: `system-${Date.now()}`,
      role: 'system' as const,
      content: '你是一个AI审计专家，负责检查其他AI输出中的问题。',
      timestamp: Date.now(),
    },
    challengerMessage, // 历史对话
    {
      id: `user-${Date.now()}`,
      role: 'user' as const,
      content: prompt,
      timestamp: Date.now(),
    },
  ];

  // 调用API
  const baseUrl = provider.baseUrl || (challengerAi === 'claude' ? 'https://api.anthropic.com' : 'https://api.openai.com');
  const apiKey = provider.apiKey;
  const model = provider.model || (challengerAi === 'claude' ? 'claude-sonnet-4-20250514' : 'gpt-4o');

  if (!apiKey) {
    throw new Error(`${challengerAi} API Key not configured`);
  }

  let response: Response;

  if (challengerAi === 'claude') {
    response = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        messages: messages.map(m => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content,
        })),
        max_tokens: 2000,
        stream: false,
      }),
    });
  } else {
    response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: messages.map(m => ({
          role: m.role === 'system' ? 'system' : m.role === 'user' ? 'user' : 'assistant',
          content: m.content,
        })),
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      }),
    });
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${challengerAi} API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();

  // 提取内容
  let content = '';
  if (challengerAi === 'claude') {
    content = data.content?.[0]?.text || '';
  } else {
    content = data.choices?.[0]?.message?.content || '';
  }

  // 解析挑刺
  const parsed = parseChallengeResponse(content, challengerAi, targetMessage.id);

  if (parsed.error) {
    console.error(`Failed to parse ${challengerAi} response:`, parsed.error);
  }

  return parsed.challenges;
}
