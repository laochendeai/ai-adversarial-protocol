/**
 * 投票API Endpoint
 * 接收多个候选答案，让启用的AI进行投票，返回共识结果
 */

import { NextRequest, NextResponse } from 'next/server';
import { VotingRequest, VotingResponse, Vote, AIProvider, AIProviderConfig } from '@/lib/types';
import { generateVotingPrompt, parseVotingResponse } from '@/lib/features/voting/prompt';
import { calculateVotingResult } from '@/lib/features/voting/calculator';
import { callClaudeAPI, callOpenAIAPI, callGeminiAPI as callGeminiAPIHelper, callOllamaAPI } from '@/lib/api-helpers';
import { getServerConfig } from '@/lib/config';

// Wrapper function for Gemini API (adapts voting route signature to api-helpers signature)
async function callGeminiAPI(
  prompt: string,
  config: AIProviderConfig
): Promise<string> {
  const serverConfig = getServerConfig();
  const response = await callGeminiAPIHelper({
    question: prompt,
    debateState: { messages: [] },
    provider: serverConfig.gemini,
  });
  return response.content;
}

// Wrapper function for Local AI/Ollama (adapts voting route signature to api-helpers signature)
async function callLocalAI(
  prompt: string,
  config: AIProviderConfig
): Promise<string> {
  const serverConfig = getServerConfig();
  const response = await callOllamaAPI({
    question: prompt,
    debateState: { messages: [] },
    provider: serverConfig.local,
  });
  return response.content;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now(); // Capture start time for duration tracking

  try {
    const body: VotingRequest = await request.json();

    const { messages, topic, providers, config, context } = body;

    // 1. 获取各AI的配置
    const providerConfigs: Record<AIProvider, AIProviderConfig> = {
      claude: {
        id: 'claude',
        name: 'Claude',
        enabled: providers.includes('claude'),
        type: 'anthropic',
        weight: 1.0,
      },
      openai: {
        id: 'openai',
        name: 'OpenAI',
        enabled: providers.includes('openai'),
        type: 'openai',
        weight: 1.0,
      },
      gemini: {
        id: 'gemini',
        name: 'Gemini',
        enabled: providers.includes('gemini'),
        type: 'google',
        weight: 1.0,
      },
      local: {
        id: 'local',
        name: 'Local AI',
        enabled: providers.includes('local'),
        type: 'ollama',
        weight: 0.5,  // 本地模型权重稍低
      },
    };

    // 2. 准备有效选项列表
    const options = messages.map(m => m.id);

    // 3. 并行调用所有启用的AI进行投票
    const votingPromises = providers
      .filter(p => providerConfigs[p].enabled)
      .map(async (providerId) => {
        const startTime = Date.now();

        try {
          // 生成prompt
          const prompt = generateVotingPrompt(
            { messages, topic, providers, config, context },
            providerId
          );

          // 调用对应的API
          let responseText: string;
          switch (providerId) {
            case 'claude':
              {
                const claudeResponse = await callClaudeAPI({ question: prompt, debateState: { messages: [] } });
                responseText = claudeResponse.content;
              }
              break;
            case 'openai':
              {
                const openaiResponse = await callOpenAIAPI({ question: prompt, debateState: { messages: [] } });
                responseText = openaiResponse.content;
              }
              break;
            case 'gemini':
              responseText = await callGeminiAPI(prompt, providerConfigs[providerId]);
              break;
            case 'local':
              responseText = await callLocalAI(prompt, providerConfigs[providerId]);
              break;
            default:
              throw new Error(`Unknown provider: ${providerId}`);
          }

          // 解析响应（传入options进行验证）
          const parsed = parseVotingResponse(responseText, providerId, topic.id, options);

          if (!parsed || !parsed.choice) {
            console.error(`Failed to parse vote from ${providerId}`);
            return null;
          }

          // 创建投票对象
          const vote: Vote = {
            id: `${topic.id}-${providerId}-${Date.now()}`,
            topicId: topic.id,
            voterId: providerId,
            choice: parsed.choice,
            confidence: parsed.confidence,
            reasoning: parsed.reasoning,
            timestamp: Date.now(),
          };

          return vote;

        } catch (error) {
          console.error(`Error getting vote from ${providerId}:`, error);
          return null;
        }
      });

    // 等待所有投票完成
    const votes = (await Promise.all(votingPromises)).filter((v): v is Vote => v !== null);

    if (votes.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No valid votes received',
      }, { status: 400 });
    }

    // 3. 计算投票结果
    const options = messages.map(m => m.id);
    const result = calculateVotingResult(votes, options, config, providerConfigs);

    // 4. 构建响应
    const responseData: VotingResponse = {
      result,
      votes,
      summary: {
        totalVotes: votes.length,
        participatedProviders: votes.map(v => v.voterId),
        consensusReached: result.consensusLevel >= config.threshold,
        timeElapsed: Date.now() - startTime,
      },
    };

    return NextResponse.json({
      success: true,
      data: responseData,
    });

  } catch (error) {
    console.error('Voting API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
