/**
 * 串行互相引用 API
 * Serial Reference API Endpoint
 *
 * POST /api/serial-reference
 *
 * 实现AI B完成 → AI A看到并回应的串行机制
 */

import { NextRequest, NextResponse } from 'next/server';
import { ChatRequest, Message, SerialReferenceConfig } from '@/lib/types';
import { selectFirstResponder, buildSerialPrompt, getSerialTimeouts } from '@/lib/features/serial-reference/utils';
import { callClaudeAPI, callOpenAIAPI } from '@/lib/api-helpers';
import { getServerConfig } from '@/lib/config';

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { question, debateState, provider, serialConfig } = body;

    if (!serialConfig?.enabled) {
      return NextResponse.json({
        success: false,
        error: 'Serial mode is not enabled',
      });
    }

    // 选择先响应的AI
    const firstResponder = selectFirstResponder(
      serialConfig,
      debateState.firstResponder
    );

    const secondResponder = firstResponder === 'claude' ? 'openai' : 'claude';

    console.log('=== Serial Reference Mode ===');
    console.log('First responder:', firstResponder);
    console.log('Second responder:', secondResponder);

    // ===== Round 1: 第一个AI响应 =====
    console.log('=== Round 1: Starting first responder ===');

    const firstRequest = {
      question,
      debateState: {
        ...debateState,
        roundType: firstResponder === 'claude' ? 'serial-a-first' : 'serial-b-first',
        currentRound: (debateState.currentRound || 0) + 1,
        firstResponder,
      },
      provider,
    };

    const firstResponsePromise = firstResponder === 'claude'
      ? callClaudeAPI(firstRequest)
      : callOpenAIAPI(firstRequest);

    // 等待第一个AI完成
    const firstResponse = await Promise.race([
      firstResponsePromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('First responder timeout')), getSerialTimeouts().firstResponder)
      ),
    ]) as { content: string; messageId: string };

    console.log('=== Round 1: First responder completed ===');
    console.log('Message ID:', firstResponse.messageId);

    // 构建第一个AI的完整消息对象
    const firstMessage: Message = {
      id: firstResponse.messageId,
      role: 'assistant',
      content: firstResponse.content,
      isClaude: firstResponder === 'claude',
      timestamp: Date.now(),
      roundType: firstResponder === 'claude' ? 'serial-a-first' : 'serial-b-first',
    };

    // ===== Round 2: 第二个AI看到第一个AI的输出并回应 =====
    console.log('=== Round 2: Starting second responder ===');

    const secondRequest = {
      question,
      debateState: {
        ...debateState,
        messages: [...debateState.messages, firstMessage], // 加入第一个AI的输出
        roundType: firstResponder === 'claude' ? 'serial-a-first' : 'serial-b-first',
        currentRound: (debateState.currentRound || 0) + 1,
        firstResponder,
      },
      opponentMessage: firstMessage, // 传递第一个AI的消息
      provider,
    };

    const secondResponsePromise = secondResponder === 'claude'
      ? callClaudeAPI(secondRequest)
      : callOpenAIAPI(secondRequest);

    // 等待第二个AI完成
    const secondResponse = await Promise.race([
      secondResponsePromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Second responder timeout')), getSerialTimeouts().secondResponder)
      ),
    ]) as { content: string; messageId: string };

    console.log('=== Round 2: Second responder completed ===');
    console.log('Message ID:', secondResponse.messageId);

    // 构建第二个AI的完整消息对象
    const secondMessage: Message = {
      id: secondResponse.messageId,
      role: 'assistant',
      content: secondResponse.content,
      isClaude: secondResponder === 'claude',
      timestamp: Date.now(),
      roundType: firstResponder === 'claude' ? 'serial-a-first' : 'serial-b-first',
      isResponseTo: firstMessage.id, // 标记为对第一个AI的回应
      referencesTo: [firstMessage.id], // 引用第一个AI的消息
    };

    // 返回两条消息（先返回第一个AI的，再返回第二个AI的）
    return NextResponse.json({
      success: true,
      data: {
        mode: 'serial',
        firstResponder,
        messages: [firstMessage, secondMessage],
        roundType: firstResponder === 'claude' ? 'serial-a-first' : 'serial-b-first',
      },
    });
  } catch (error) {
    console.error('Serial reference error:', error);

    // 错误处理
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        fallback: 'consider-parallel-mode', // 建议降级到并行模式
      },
      { status: 500 }
    );
  }
}
