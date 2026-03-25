'use client';

import { useState, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useAppStore, useDebateState, useIsStreaming } from '@/lib/store';
import { Message } from '@/lib/types';
import { loadConversation } from '@/lib/conversation-store';
import { autoApplyServerConfig } from '@/lib/config-sync';
import MainLayout from '@/components/MainLayout';

// Code splitting: Dynamic imports for heavy components
const SettingsPanel = dynamic(() => import('@/components/SettingsPanel'), {
  loading: () => <div className="px-4 py-2 text-gray-500">Loading settings...</div>,
});

const AuditDashboard = dynamic(() => import('@/components/AuditDashboard'), {
  loading: () => <div className="bg-gray-100 px-3 py-1.5 rounded-lg text-sm">Loading audit...</div>,
});

const SerialModePanel = dynamic(() => import('@/components/SerialModePanel'), {
  loading: () => <div className="bg-white rounded-lg shadow-md p-4">Loading serial mode...</div>,
});

const AutoChallengeConfigPanel = dynamic(() => import('@/components/AutoChallengeConfigPanel'), {
  loading: () => <div className="bg-white rounded-lg shadow-md p-4">Loading auto-challenge config...</div>,
});

const MultiAIConfigPanel = dynamic(() => import('@/components/MultiAIConfigPanel'), {
  loading: () => <div className="bg-white rounded-lg shadow-md p-4">Loading multi-AI config...</div>,
});

const AutoChallengePanel = dynamic(() => import('@/components/AutoChallengePanel'), {
  loading: () => <div className="bg-white rounded-lg shadow-md p-4">Loading challenges...</div>,
});

const VotingResultPanel = dynamic(() => import('@/components/VotingResultPanel'), {
  loading: () => <div className="bg-white rounded-lg shadow-md p-4">Loading voting results...</div>,
});

export default function Home() {
  const [question, setQuestion] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);
  const [configSynced, setConfigSynced] = useState(false);
  const [showConfigTip, setShowConfigTip] = useState(false);
  const [autoChallenges, setAutoChallenges] = useState<any[]>([]); // 自动挑刺结果
  const [showVotingResult, setShowVotingResult] = useState(false); // 是否显示投票结果

  const {
    addMessage,
    updateMessage,
    setStreaming,
    setClaudeError,
    setOpenAIError,
    clearErrors,
    clearMessages,
    isSettingsOpen,
    openSettings,
    closeSettings,
    serialConfig,
    updateSerialConfig,
    autoChallengeConfig,
    updateAutoChallengeConfig,
    addChallenge,
    aiProviders,
    updateAIProviders,
    votingConfig,
    updateVotingConfig,
    votingResult,
    setVotingResult,
  } = useAppStore();

  const debateState = useDebateState();
  const isStreaming = useIsStreaming();

  // 首次加载时同步服务器端配置
  useEffect(() => {
    const syncConfig = async () => {
      const applied = await autoApplyServerConfig();
      if (applied) {
        setConfigSynced(true);
        setShowConfigTip(true);
        // 5秒后自动隐藏提示
        setTimeout(() => setShowConfigTip(false), 5000);
      }
    };
    syncConfig();
  }, []);

  // 从LocalStorage恢复对话历史
  useEffect(() => {
    const saved = loadConversation();
    if (saved && saved.messages && saved.messages.length > 0) {
      // 恢复消息、挑战和token计数
      saved.messages.forEach(msg => addMessage(msg));
      // 注意：challenges会在addChallenge时自动保存，这里不需要重复添加
      if (saved.challenges) {
        saved.challenges.forEach(challenge => {
          // 触发store的addChallenge
          useAppStore.getState().addChallenge(challenge);
        });
      }
    }
    setIsLoaded(true);
  }, []); // 只在组件挂载时运行一次

  const handleStream = async () => {
    if (!question.trim()) return;

    // 添加用户消息
    const userMessage: Message = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      role: 'user',
      content: question,
      timestamp: Date.now(),
    };
    addMessage(userMessage);

    // 清空输入框
    const currentQuestion = question;
    setQuestion('');
    clearErrors();
    setStreaming(true);

    try {
      console.log('=== Starting API calls ===');
      console.log('Question:', currentQuestion);
      console.log('Messages count:', debateState.messages.length);

      // 并行调用两个API
      const controllers = {
        claude: new AbortController(),
        openai: new AbortController(),
      };

      const timeoutId = setTimeout(() => {
        console.log('=== Timeout reached, aborting requests ===');
        controllers.claude.abort();
        controllers.openai.abort();
      }, 60000); // 60秒超时

      // 创建消息ID
      const timestamp = Date.now();
      let claudeMessageId = `${timestamp}-${Math.random().toString(36).substring(2, 9)}-claude`;
      let openaiMessageId = `${timestamp + 1}-${Math.random().toString(36).substring(2, 9)}-openai`;

      console.log('Claude message ID:', claudeMessageId);
      console.log('OpenAI message ID:', openaiMessageId);

      // 立即添加空消息到 MainLayout，让用户看到 AI 正在思考
      addMessage({
        id: claudeMessageId,
        role: 'assistant',
        content: '...',
        isClaude: true,
        timestamp: Date.now(),
      });
      addMessage({
        id: openaiMessageId,
        role: 'assistant',
        content: '...',
        isClaude: false,
        timestamp: Date.now(),
      });

      const [claudeResponse, openaiResponse] = await Promise.allSettled([
        fetch('/api/claude', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: currentQuestion,
            debateState: { messages: debateState.messages },
          }),
          signal: controllers.claude.signal,
        }),
        fetch('/api/openai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: currentQuestion,
            debateState: { messages: debateState.messages },
          }),
          signal: controllers.openai.signal,
        }),
      ]);

      clearTimeout(timeoutId);

      console.log('=== API calls settled ===');
      console.log('Claude response status:', claudeResponse.status);
      console.log('OpenAI response status:', openaiResponse.status);

      if (claudeResponse.status === 'fulfilled') {
        console.log('Claude HTTP status:', claudeResponse.value.status);
      }
      if (openaiResponse.status === 'fulfilled') {
        console.log('OpenAI HTTP status:', openaiResponse.value.status);
      }

      // 处理Claude响应
      if (claudeResponse.status === 'fulfilled' && claudeResponse.value.ok) {
        console.log('=== Starting Claude stream processing ===');
        const reader = claudeResponse.value.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullContent = '';
        let chunkCount = 0;
        let lastChunkTime = Date.now();
        const CHUNK_TIMEOUT = 30000; // 30秒超时

        try {
          while (true) {
            // 检查超时
            if (Date.now() - lastChunkTime > CHUNK_TIMEOUT) {
              console.error('Claude stream timeout after', CHUNK_TIMEOUT, 'ms');
              setClaudeError('响应超时');
              break;
            }

            const result = await Promise.race([
              reader!.read(),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Read timeout')), 30000)
              )
            ]);

            if (result instanceof Error) {
              // 读取超时，尝试继续读取（可能服务器还在处理）
              console.warn('Claude read timeout, retrying...');
              continue;
            }

            const { done, value } = result as ReadableStreamReadResult<Uint8Array>;
            lastChunkTime = Date.now();

            if (done) {
              console.log(`=== Claude stream done, total chunks: ${chunkCount}, content length: ${fullContent.length} ===`);
              break;
            }

            chunkCount++;
            if (chunkCount === 1) {
              console.log('Claude: received first chunk, size:', value.length);
            }
            if (chunkCount % 10 === 0) {
              console.log(`Claude: received chunk ${chunkCount}, buffer size: ${buffer.length}, content length: ${fullContent.length}`);
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.trim() === '') continue;
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  if (data.error) {
                    console.error('Claude error:', data.error);
                    setClaudeError(data.error);
                  } else if (data.content) {
                    fullContent += data.content;
                    // 实时更新 MainLayout 中的消息
                    updateMessage(claudeMessageId, fullContent);
                  }
                } catch (e) {
                  console.error('Parse error:', e, 'Line:', line);
                }
              }
            }
          }
        } catch (error) {
          console.error('Claude stream error:', error);
          setClaudeError(`Stream error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        // Claude streaming 完成
        console.log('=== Claude streaming completed ===');
        console.log('Content length:', fullContent.length);
      } else {
        const error = claudeResponse.status === 'fulfilled'
          ? await claudeResponse.value.json().catch(() => ({ error: 'Claude API failed' }))
          : { error: claudeResponse.reason?.message || 'Request failed' };
        setClaudeError(error.error || 'Claude API请求失败');
      }

      // 处理OpenAI响应
      if (openaiResponse.status === 'fulfilled' && openaiResponse.value.ok) {
        console.log('=== Starting OpenAI stream processing ===');
        const reader = openaiResponse.value.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullContent = '';
        let chunkCount = 0;
        let lastChunkTime = Date.now();
        const CHUNK_TIMEOUT = 30000; // 30秒超时

        try {
          while (true) {
            // 检查超时
            if (Date.now() - lastChunkTime > CHUNK_TIMEOUT) {
              console.error('OpenAI stream timeout after', CHUNK_TIMEOUT, 'ms');
              setOpenAIError('响应超时');
              break;
            }

            const result = await Promise.race([
              reader!.read(),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Read timeout')), 30000)
              )
            ]);

            if (result instanceof Error) {
              // 读取超时，尝试继续读取（可能服务器还在处理）
              console.warn('OpenAI read timeout, retrying...');
              continue;
            }

            const { done, value } = result as ReadableStreamReadResult<Uint8Array>;
            lastChunkTime = Date.now();

            if (done) {
              console.log(`=== OpenAI stream done, total chunks: ${chunkCount}, content length: ${fullContent.length} ===`);
              break;
            }

            chunkCount++;
            if (chunkCount === 1) {
              console.log('OpenAI: received first chunk, size:', value.length);
            }
            if (chunkCount % 10 === 0) {
              console.log(`OpenAI: received chunk ${chunkCount}, buffer size: ${buffer.length}, content length: ${fullContent.length}`);
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.trim() === '') continue;
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  if (data.error) {
                    console.error('OpenAI error:', data.error);
                    setOpenAIError(data.error);
                  } else if (data.content) {
                    fullContent += data.content;
                    // 实时更新 MainLayout 中的消息
                    updateMessage(openaiMessageId, fullContent);
                  }
                } catch (e) {
                  console.error('Parse error:', e, 'Line:', line);
                }
              }
            }
          }
        } catch (error) {
          console.error('OpenAI stream error:', error);
          setOpenAIError(`Stream error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        // OpenAI streaming 完成
        console.log('=== OpenAI streaming completed ===');
        console.log('Content length:', fullContent.length);
      } else {
        const error = openaiResponse.status === 'fulfilled'
          ? await openaiResponse.value.json().catch(() => ({ error: 'OpenAI API failed' }))
          : { error: openaiResponse.reason?.message || 'Request failed' };
        setOpenAIError(error.error || 'OpenAI API请求失败');
      }
    } catch (error) {
      console.error('Stream error:', error);
      console.error('Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          setClaudeError('请求超时（60秒）');
          setOpenAIError('请求超时（60秒）');
        } else {
          setClaudeError(`错误: ${error.message}`);
          setOpenAIError(`错误: ${error.message}`);
        }
      } else {
        setClaudeError('未知错误');
        setOpenAIError('未知错误');
      }
    } finally {
      setStreaming(false);

      // Phase 2 - Feature 2: 自动挑刺 (在两个AI都完成后)
      if (autoChallengeConfig.enabled && !setClaudeError && !setOpenAIError) {
        try {
          await triggerAutoChallenge();
        } catch (error) {
          console.error('Auto-challenge failed:', error);
        }
      }

      // Phase 2 - Feature 4: 多AI投票 (在自动挑刺之后)
      if (votingConfig.enabled && votingResult === undefined) {
        try {
          await triggerVoting();
        } catch (error) {
          console.error('Voting failed:', error);
        }
      }
    }
  };

  /**
   * 触发投票
   */
  const triggerVoting = async () => {
    // 找到最新的Claude和OpenAI消息
    const claudeMessage = debateState.messages
      .filter(m => m.isClaude === true)
      .slice(-1)[0];
    const openaiMessage = debateState.messages
      .filter(m => m.isClaude === false)
      .slice(-1)[0];

    if (!claudeMessage || !openaiMessage) {
      console.log('Skipping voting: missing messages');
      return;
    }

    // 检查是否有足够的AI启用
    const enabledProviders = Object.entries(aiProviders)
      .filter(([_, config]) => config.enabled)
      .map(([id, _]) => id as any);

    if (enabledProviders.length < 2) {
      console.log('Skipping voting: need at least 2 AI providers');
      return;
    }

    console.log('=== Triggering Multi-AI Voting ===');

    try {
      const response = await fetch('/api/voting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [claudeMessage, openaiMessage],
          topic: {
            id: `vote-${Date.now()}`,
            type: 'best-answer',
            description: '选择最好的回答',
            options: [claudeMessage.id, openaiMessage.id],
            createdAt: Date.now(),
          },
          providers: enabledProviders,
          config: votingConfig,
          context: question,
        }),
      });

      if (!response.ok) {
        throw new Error('Voting API failed');
      }

      const data = await response.json();

      if (data.success) {
        console.log('Voting completed:', data.data);
        setVotingResult(data.data.result);
        setShowVotingResult(true);
      }
    } catch (error) {
      console.error('Voting error:', error);
    }
  };

  /**
   * 触发自动挑刺
   */
  const triggerAutoChallenge = async () => {
    // 找到最新的Claude和OpenAI消息
    const claudeMessage = debateState.messages
      .filter(m => m.isClaude === true)
      .slice(-1)[0];
    const openaiMessage = debateState.messages
      .filter(m => m.isClaude === false)
      .slice(-1)[0];

    if (!claudeMessage || !openaiMessage) {
      console.log('Skipping auto-challenge: missing messages');
      return;
    }

    console.log('=== Triggering Auto-Challenge ===');

    const response = await fetch('/api/auto-challenge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messageA: claudeMessage,
        messageB: openaiMessage,
        config: autoChallengeConfig,
      }),
    });

    if (!response.ok) {
      throw new Error('Auto-challenge API failed');
    }

    const data = await response.json();

    if (data.success && data.data.challenges.length > 0) {
      console.log('Auto-challenges found:', data.data.challenges.length);
      setAutoChallenges(data.data.challenges);

      // 将自动挑刺添加到debateState
      data.data.challenges.forEach((challenge: any) => {
        // 找到目标消息的索引
        const targetIndex = debateState.messages.findIndex(m => m.id === challenge.targetMessageId);
        if (targetIndex !== -1) {
          challenge.messageIndex = targetIndex;
          addChallenge(challenge);
        }
      });
    } else {
      setAutoChallenges([]);
    }
  };

  const handleClearHistory = () => {
    if (confirm('确定要清空所有对话历史吗？')) {
      clearMessages();
      localStorage.removeItem('ai-adversarial-conversation');
    }
  };

  return (
    <>
      {/* 配置同步提示 */}
      {showConfigTip && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">✅</span>
              <div>
                <div className="font-semibold text-blue-900">已自动应用服务器配置</div>
                <div className="text-sm text-blue-700">
                  从 ~/.claude 和 ~/.codex 检测到的配置已自动应用
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowConfigTip(false)}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              关闭
            </button>
          </div>
        </div>
      )}

      <MainLayout>
        {/* 设置按钮和审计评分按钮 */}
        <div className="flex gap-2">
          <Suspense fallback={<div className="bg-gray-100 px-3 py-1.5 rounded-lg text-sm">Loading audit...</div>}>
            <AuditDashboard />
          </Suspense>
          <button
            onClick={openSettings}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium"
          >
            ⚙️ 设置
          </button>
        </div>
      </MainLayout>

      {/* 串行模式面板 */}
      <div className="max-w-7xl mx-auto px-4 pt-4">
        <Suspense fallback={<div className="bg-white rounded-lg shadow-md p-4">Loading serial mode...</div>}>
          <SerialModePanel
            config={serialConfig}
            onConfigChange={updateSerialConfig}
            isLoading={isStreaming}
            currentRound={debateState.currentRound}
            firstResponder={debateState.firstResponder}
          />
        </Suspense>
      </div>

      {/* 自动挑刺配置面板 */}
      <div className="max-w-7xl mx-auto px-4 pb-4">
        <Suspense fallback={<div className="bg-white rounded-lg shadow-md p-4">Loading auto-challenge config...</div>}>
          <AutoChallengeConfigPanel
            config={autoChallengeConfig}
            onConfigChange={updateAutoChallengeConfig}
            isLoading={isStreaming}
          />
        </Suspense>
      </div>

      {/* 多AI投票配置面板 */}
      <div className="max-w-7xl mx-auto px-4 pb-4">
        <Suspense fallback={<div className="bg-white rounded-lg shadow-md p-4">Loading multi-AI config...</div>}>
          <MultiAIConfigPanel
            providers={aiProviders}
            votingConfig={votingConfig}
            onProvidersChange={updateAIProviders}
            onVotingConfigChange={updateVotingConfig}
            isLoading={isStreaming}
          />
        </Suspense>
      </div>

      {/* 自动挑刺面板 */}
      {autoChallenges.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 pb-4">
          <Suspense fallback={<div className="bg-white rounded-lg shadow-md p-4">Loading challenges...</div>}>
            <AutoChallengePanel
              challenges={autoChallenges}
              onChallengeAction={(challengeId, action) => {
                console.log('Challenge action:', challengeId, action);
                // TODO: 实现接受/拒绝/辩论逻辑
              }}
            />
          </Suspense>
        </div>
      )}

      {/* 投票结果面板 */}
      {showVotingResult && votingResult && (
        <div className="max-w-7xl mx-auto px-4 pb-4">
          <Suspense fallback={<div className="bg-white rounded-lg shadow-md p-4">Loading voting results...</div>}>
            <VotingResultPanel
              result={votingResult}
              messages={debateState.messages}
              onClose={() => setShowVotingResult(false)}
            />
          </Suspense>
        </div>
      )}

      {/* 输入区域 */}
      <div className="max-w-7xl mx-auto px-4 pb-6">
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="输入你的问题... (Enter your question...)"
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyPress={(e) => e.key === 'Enter' && !isStreaming && handleStream()}
              disabled={isStreaming}
            />
            <button
              onClick={handleStream}
              disabled={isStreaming || !question.trim()}
              className={`px-6 py-2 rounded-lg font-semibold ${
                isStreaming || !question.trim()
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              {isStreaming ? '生成中...' : '发送'}
            </button>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-3 mt-4">
          <button
            onClick={handleClearHistory}
            className="px-4 py-2 rounded-lg font-semibold bg-red-100 hover:bg-red-200 text-red-700 text-sm"
          >
            🗑️ 清空历史
          </button>
          <button
            onClick={() => window.open('/config-info', '_blank')}
            className="px-4 py-2 rounded-lg font-semibold bg-blue-100 hover:bg-blue-200 text-blue-700 text-sm"
          >
            🔧 查看配置
          </button>
        </div>
      </div>

      {/* 设置面板 */}
      <SettingsPanel isOpen={isSettingsOpen} onClose={closeSettings} />
    </>
  );
}
