/**
 * API辅助函数
 * 用于串行引用等需要non-streaming调用的场景
 */

import { Message, ProviderConfig } from './types';
import { streamClaudeResponse, ClaudeResponse } from './claude-client';
import { streamOpenAIResponse, OpenAIResponse } from './openai-client';
import { getServerConfig } from './config';

/**
 * 调用Claude API（非streaming，用于串行模式）
 */
export async function callClaudeAPI(params: {
  question: string;
  debateState: { messages: Message[] };
  opponentMessage?: Message;
  provider?: ProviderConfig;
}): Promise<{ content: string; messageId: string }> {
  const { question, debateState, opponentMessage, provider: providerOverride } = params;

  // 构建消息列表
  const messages: Message[] = [
    ...debateState.messages,
    {
      id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      role: 'user',
      content: question,
      timestamp: Date.now(),
    },
  ];

  const messageId = `claude-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  // 获取server config（优先使用provider覆盖）
  const serverConfig = getServerConfig();
  const provider: ProviderConfig = providerOverride
    ? { ...serverConfig.claude, ...providerOverride }
    : serverConfig.claude;

  let fullContent = '';

  const response: ClaudeResponse = await streamClaudeResponse({
    messages,
    provider,
    onChunk: (content, done) => {
      fullContent += content;
    },
    opponentMessage,
  });

  return {
    content: fullContent || response.content,
    messageId,
  };
}

/**
 * 调用OpenAI API（非streaming，用于串行模式）
 */
export async function callOpenAIAPI(params: {
  question: string;
  debateState: { messages: Message[] };
  opponentMessage?: Message;
  provider?: ProviderConfig;
}): Promise<{ content: string; messageId: string }> {
  const { question, debateState, opponentMessage, provider: providerOverride } = params;

  // 构建消息列表
  const messages: Message[] = [
    ...debateState.messages,
    {
      id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      role: 'user',
      content: question,
      timestamp: Date.now(),
    },
  ];

  const messageId = `openai-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  // 获取server config（优先使用provider覆盖）
  const serverConfig = getServerConfig();
  const provider: ProviderConfig = providerOverride
    ? { ...serverConfig.openai, ...providerOverride }
    : serverConfig.openai;

  let fullContent = '';

  const response: OpenAIResponse = await streamOpenAIResponse({
    messages,
    provider,
    onChunk: (content, done) => {
      fullContent += content;
    },
    opponentMessage,
  });

  return {
    content: fullContent || response.content,
    messageId,
  };
}
