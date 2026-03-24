'use client';

import { useState, useEffect } from 'react';
import MainLayout from '@/components/MainLayout';
import SettingsPanel from '@/components/SettingsPanel';
import { useAppStore, useDebateState, useIsStreaming } from '@/lib/store';
import { Message } from '@/lib/types';
import { loadConversation } from '@/lib/conversation-store';
import { autoApplyServerConfig } from '@/lib/config-sync';

export default function Home() {
  const [question, setQuestion] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);
  const [configSynced, setConfigSynced] = useState(false);
  const [showConfigTip, setShowConfigTip] = useState(false);

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

        while (true) {
          const { done, value } = await reader!.read();
          if (done) {
            console.log(`=== Claude stream done, total chunks: ${chunkCount}, content length: ${fullContent.length} ===`);
            break;
          }

          chunkCount++;
          if (chunkCount % 10 === 0) {
            console.log(`Claude: received chunk ${chunkCount}, buffer size: ${buffer.length}`);
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
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

        while (true) {
          const { done, value } = await reader!.read();
          if (done) {
            console.log(`=== OpenAI stream done, total chunks: ${chunkCount}, content length: ${fullContent.length} ===`);
            break;
          }

          chunkCount++;
          if (chunkCount % 10 === 0) {
            console.log(`OpenAI: received chunk ${chunkCount}, buffer size: ${buffer.length}`);
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
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
        {/* 设置按钮 */}
        <button
          onClick={openSettings}
          className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium"
        >
          ⚙️ 设置
        </button>
      </MainLayout>

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
