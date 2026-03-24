/**
 * 串行模式面板
 * Serial Mode Panel
 *
 * 用于切换并行/串行模式，并显示串行模式的状态
 */

'use client';

import { useState } from 'react';
import { SerialReferenceConfig } from '@/lib/types';

interface SerialModePanelProps {
  config: SerialReferenceConfig;
  onConfigChange: (config: SerialReferenceConfig) => void;
  isLoading?: boolean;
  currentRound?: number;
  firstResponder?: 'claude' | 'openai';
}

export default function SerialModePanel({
  config,
  onConfigChange,
  isLoading = false,
  currentRound,
  firstResponder,
}: SerialModePanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleModeChange = (enabled: boolean) => {
    onConfigChange({
      ...config,
      enabled,
    });
  };

  const handleResponderChange = (firstResponder: 'auto' | 'claude' | 'openai') => {
    onConfigChange({
      ...config,
      firstResponder,
    });
  };

  const getModeLabel = () => {
    if (!config.enabled) return '并行模式';
    if (config.firstResponder === 'auto') return '串行模式 (轮流)';
    return `串行模式 (${config.firstResponder === 'claude' ? 'Claude' : 'OpenAI'}先)`;
  };

  const getModeEmoji = () => {
    if (!config.enabled) return '⚡';
    return '🔄';
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-4">
      {/* 标题栏 */}
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">{getModeEmoji()}</span>
          <span className="font-medium text-gray-700">{getModeLabel()}</span>
          {currentRound && (
            <span className="text-sm text-gray-500">(第{currentRound}轮)</span>
          )}
        </div>
        <button className="text-gray-400 hover:text-gray-600">
          {isExpanded ? '▼' : '▶'}
        </button>
      </div>

      {/* 详细配置 */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          {/* 模式切换 */}
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              对抗模式
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => handleModeChange(false)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  !config.enabled
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                disabled={isLoading}
              >
                ⚡ 并行
              </button>
              <button
                onClick={() => handleModeChange(true)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  config.enabled
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                disabled={isLoading}
              >
                🔄 串行
              </button>
            </div>
          </div>

          {/* 串行模式配置 */}
          {config.enabled && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                先响应者
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => handleResponderChange('auto')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                    config.firstResponder === 'auto'
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  disabled={isLoading}
                >
                  🔄 自动轮流
                </button>
                <button
                  onClick={() => handleResponderChange('claude')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                    config.firstResponder === 'claude'
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  disabled={isLoading}
                >
                  Claude先
                </button>
                <button
                  onClick={() => handleResponderChange('openai')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                    config.firstResponder === 'openai'
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  disabled={isLoading}
                >
                  OpenAI先
                </button>
              </div>

              {/* 说明文本 */}
              <div className="mt-2 p-2 bg-blue-50 rounded-lg text-xs text-blue-700">
                <p>📌 串行模式：AI B完成 → AI A看到并回应</p>
                <p>⏱️ 响应时间：~2倍并行模式</p>
                <p>💡 优势：真正的互相引用和反驳</p>
              </div>
            </div>
          )}

          {/* 当前状态 */}
          {firstResponder && (
            <div className="mt-3 p-2 bg-yellow-50 rounded-lg text-xs text-yellow-700">
              <p>当前轮次：{firstResponder === 'claude' ? 'Claude' : 'OpenAI'}先响应</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
