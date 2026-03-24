'use client';

import { useState } from 'react';
import { useDebateState, useErrors, useSettings, useAppStore } from '@/lib/store';
import { useEffect, useRef } from 'react';
import ChallengeForm from './ChallengeForm';
import ThinkingBlockDisplay from './ThinkingBlock';
import { parseThinkingBlocks, removeThinkingTags } from '@/lib/features/thinking-visualization';

interface MainLayoutProps {
  children?: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const debateState = useDebateState();
  const errors = useErrors();
  const settings = useSettings();
  const clearMessages = useAppStore((state) => state.clearMessages);

  const claudeRef = useRef<HTMLDivElement>(null);
  const openaiRef = useRef<HTMLDivElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  // 客户端挂载状态
  const [mounted, setMounted] = useState(false);

  // 挑战表单状态
  const [challengeForm, setChallengeForm] = useState<{
    isOpen: boolean;
    messageIndex: number;
  }>({ isOpen: false, messageIndex: -1 });

  // 等待客户端挂载
  useEffect(() => {
    setMounted(true);
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    claudeRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [debateState.messages]);

  useEffect(() => {
    openaiRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [debateState.messages]);

  useEffect(() => {
    transcriptRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [debateState.messages]);

  // 计算token成本
  const calculateCost = () => {
    // Claude: $3/1M input, $15/1M output
    const claudeCost =
      (debateState.tokenCount.claude / 1000) * 0.003 +
      (debateState.tokenCount.claude / 1000) * 0.015;

    // OpenAI: $2.5/1M input, $10/1M output
    const openaiCost =
      (debateState.tokenCount.openai / 1000) * 0.0025 +
      (debateState.tokenCount.openai / 1000) * 0.01;

    return claudeCost + openaiCost;
  };

  const totalCost = calculateCost();
  const budget = settings.sessionBudget || 5.0;
  const budgetWarning = totalCost > budget * 0.8;

  const handleOpenChallenge = (messageIndex: number) => {
    setChallengeForm({ isOpen: true, messageIndex });
  };

  const handleCloseChallenge = () => {
    setChallengeForm({ isOpen: false, messageIndex: -1 });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">AI对抗协议</h1>
            <p className="text-sm text-gray-500">Claude vs OpenAI/Codex</p>
          </div>

          <div className="flex items-center gap-4">
            {/* Token计数和成本 */}
            <div className={`text-sm ${budgetWarning ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
              <span>Token: C:{debateState.tokenCount.claude} O:{debateState.tokenCount.openai}</span>
              <span className="ml-2">
                ${totalCost.toFixed(4)}
                {budgetWarning && ' ⚠️'}
              </span>
            </div>

            {children}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* 左右分屏 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Claude Panel */}
          <div className={`bg-white rounded-lg shadow-md ${errors.claude ? 'ring-2 ring-red-500' : ''}`}>
            <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Claude</h2>
              {errors.claude && (
                <span className="text-red-500 text-sm">❌ {errors.claude}</span>
              )}
              {!errors.claude && mounted && (
                <span className="text-xs text-gray-500">
                  {settings.claude.type === 'custom' ? '🔗 第三方中转' : '🌐 官方API'}
                </span>
              )}
            </div>
            <div className="p-4">
              <div className="bg-gray-50 rounded-lg p-4 min-h-[300px] max-h-[500px] overflow-y-auto">
                {debateState.messages
                  .filter((m) => m.isClaude === true)
                  .map((msg, idx) => {
                    const globalIndex = debateState.messages.findIndex(m => m.id === msg.id);

                    // Phase 2 - Feature 3: 解析thinking块
                    const thinkingBlocks = parseThinkingBlocks(msg.content, msg.id);
                    const cleanContent = removeThinkingTags(msg.content);

                    return (
                      <div key={msg.id} className="mb-4 group">
                        {/* 显示thinking块 */}
                        {thinkingBlocks.length > 0 && thinkingBlocks.map((block) => (
                          <ThinkingBlockDisplay
                            key={block.id}
                            block={block}
                            displayMode="inline"
                          />
                        ))}

                        {/* 显示清理后的内容 */}
                        <div className="text-sm text-gray-600 whitespace-pre-wrap">{cleanContent}</div>
                        <button
                          onClick={() => handleOpenChallenge(globalIndex)}
                          className="mt-2 text-xs text-yellow-600 hover:text-yellow-800 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          🎯 挑战此回复
                        </button>
                      </div>
                    );
                  })}
                {debateState.isStreaming && !debateState.messages.some(m => m.isClaude === true) && (
                  <div className="text-gray-400">生成中...</div>
                )}
                <div ref={claudeRef} />
              </div>
            </div>
          </div>

          {/* OpenAI Panel */}
          <div className={`bg-white rounded-lg shadow-md ${errors.openai ? 'ring-2 ring-red-500' : ''}`}>
            <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">OpenAI / Codex</h2>
              {errors.openai && (
                <span className="text-red-500 text-sm">❌ {errors.openai}</span>
              )}
              {!errors.openai && mounted && (
                <span className="text-xs text-gray-500">
                  {settings.openai.type === 'custom' ? '🔗 第三方中转' : '🌐 官方API'}
                </span>
              )}
            </div>
            <div className="p-4">
              <div className="bg-gray-50 rounded-lg p-4 min-h-[300px] max-h-[500px] overflow-y-auto">
                {debateState.messages
                  .filter((m) => m.isClaude === false)
                  .map((msg) => {
                    const globalIndex = debateState.messages.findIndex(m => m.id === msg.id);

                    // Phase 2 - Feature 3: 解析thinking块
                    const thinkingBlocks = parseThinkingBlocks(msg.content, msg.id);
                    const cleanContent = removeThinkingTags(msg.content);

                    return (
                      <div key={msg.id} className="mb-4 group">
                        {/* 显示thinking块 */}
                        {thinkingBlocks.length > 0 && thinkingBlocks.map((block) => (
                          <ThinkingBlockDisplay
                            key={block.id}
                            block={block}
                            displayMode="inline"
                          />
                        ))}

                        {/* 显示清理后的内容 */}
                        <div className="text-sm text-gray-600 whitespace-pre-wrap">{cleanContent}</div>
                        <button
                          onClick={() => handleOpenChallenge(globalIndex)}
                          className="mt-2 text-xs text-yellow-600 hover:text-yellow-800 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          🎯 挑战此回复
                        </button>
                      </div>
                    );
                  })}
                {debateState.isStreaming && !debateState.messages.some(m => m.isClaude === false) && (
                  <div className="text-gray-400">生成中...</div>
                )}
                <div ref={openaiRef} />
              </div>
            </div>
          </div>
        </div>

        {/* 挑战记录 */}
        {debateState.challenges.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">🎯 挑战记录</h3>
              <span className="text-sm text-gray-500">{debateState.challenges.length} 条挑战</span>
            </div>
            <div className="space-y-2">
              {debateState.challenges.map((challenge, idx) => {
                const targetMessage = debateState.messages[challenge.messageIndex];
                return (
                  <div key={challenge.id} className="border-l-4 border-yellow-500 pl-4 py-2 bg-yellow-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-gray-700 mb-1">
                          挑战 #{challenge.messageIndex + 1}
                          {targetMessage && (
                            <span className="text-xs font-normal text-gray-500 ml-2">
                              ({targetMessage.isClaude ? 'Claude' : 'OpenAI'})
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-700">{challenge.reason}</div>
                      </div>
                      <span className="text-xs text-gray-400">
                        {new Date(challenge.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 共享转录 */}
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">📝 共享转录（完整历史）</h3>
              {debateState.messages.length > 0 && (
                <button
                  onClick={() => {
                    if (confirm('确定要清空所有对话记录吗？')) {
                      clearMessages();
                    }
                  }}
                  className="text-sm text-red-600 hover:text-red-800"
                >
                  清空记录
                </button>
              )}
            </div>
          <div className="bg-gray-50 rounded-lg p-4 max-h-[400px] overflow-y-auto">
            {debateState.messages.length === 0 ? (
              <div className="text-gray-400 text-sm">暂无对话记录... 输入问题开始对话</div>
            ) : (
              debateState.messages.map((msg, idx) => (
                <div key={msg.id} className="mb-3 pb-3 border-b border-gray-200 last:border-0">
                  <div className="flex items-start gap-2">
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${
                      msg.role === 'user'
                        ? 'bg-blue-100 text-blue-700'
                        : msg.isClaude
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {msg.role === 'user' ? 'User' : msg.isClaude ? 'Claude' : 'OpenAI'}
                    </span>
                    <div className="flex-1">
                      <div className="text-sm text-gray-700 whitespace-pre-wrap">{msg.content}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={transcriptRef} />
          </div>
        </div>
      </main>

      {/* 挑战表单 */}
      <ChallengeForm
        isOpen={challengeForm.isOpen}
        messageIndex={challengeForm.messageIndex}
        onClose={handleCloseChallenge}
      />
    </div>
  );
}
