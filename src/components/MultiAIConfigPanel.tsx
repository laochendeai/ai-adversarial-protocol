/**
 * 多AI配置面板
 * Multi-AI Configuration Panel
 */

'use client';

import { useState } from 'react';
import { AIProvider, AIProviderConfig, VotingConfig } from '@/lib/types';

interface MultiAIConfigPanelProps {
  providers: Record<AIProvider, AIProviderConfig>;
  votingConfig: VotingConfig;
  onProvidersChange: (providers: Record<AIProvider, AIProviderConfig>) => void;
  onVotingConfigChange: (config: VotingConfig) => void;
  isLoading?: boolean;
}

export default function MultiAIConfigPanel({
  providers,
  votingConfig,
  onProvidersChange,
  onVotingConfigChange,
  isLoading = false,
}: MultiAIConfigPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleProvider = (providerId: AIProvider) => {
    onProvidersChange({
      ...providers,
      [providerId]: {
        ...providers[providerId],
        enabled: !providers[providerId].enabled,
      },
    });
  };

  const updateProviderWeight = (providerId: AIProvider, weight: number) => {
    onProvidersChange({
      ...providers,
      [providerId]: {
        ...providers[providerId],
        weight,
      },
    });
  };

  const getEnabledCount = () => {
    return Object.values(providers).filter(p => p.enabled).length;
  };

  const getProviderEmoji = (providerId: AIProvider) => {
    switch (providerId) {
      case 'claude': return '🧠';
      case 'openai': return '🤖';
      case 'gemini': return '✨';
      case 'local': return '💻';
      default: return '❓';
    }
  };

  const getEnabledProviders = () => {
    return (Object.keys(providers) as AIProvider[]).filter((providerId) => providers[providerId].enabled);
  };

  const ensureExpertProvider = (mode: VotingConfig['mode']) => {
    if (mode !== 'expert-weighted' || votingConfig.expertProvider) {
      return votingConfig.expertProvider;
    }

    return getEnabledProviders()[0] || 'claude';
  };

  const getModeLabel = (mode: VotingConfig['mode']) => {
    switch (mode) {
      case 'majority': return '简单多数';
      case 'weighted': return '加权投票';
      case 'expert-weighted': return '专家加权';
      case 'consensus': return '共识阈值';
      case 'unanimous': return '一致同意';
      default: return '未知';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-4">
      {/* 标题栏 */}
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">🗳️</span>
          <span className="font-medium text-gray-700">
            多AI投票
            {votingConfig.enabled && <span className="ml-2 text-green-500">({getEnabledCount()}个AI已启用)</span>}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onVotingConfigChange({
                ...votingConfig,
                enabled: !votingConfig.enabled,
              });
            }}
            className={`px-3 py-1 rounded-lg text-sm font-medium ${
              votingConfig.enabled
                ? 'bg-green-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            disabled={isLoading}
          >
            {votingConfig.enabled ? '✓ 已启用' : '启用'}
          </button>
          <button className="text-gray-400 hover:text-gray-600">
            {isExpanded ? '▼' : '▶'}
          </button>
        </div>
      </div>

      {/* 详细配置 */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-gray-200 space-y-4">
          {/* AI provider配置 */}
          <div>
            <h4 className="font-medium text-gray-700 mb-2">启用的AI模型</h4>
            <div className="space-y-2">
              {(Object.keys(providers) as AIProvider[]).map((providerId) => {
                const provider = providers[providerId];
                return (
                  <div
                    key={providerId}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`provider-${providerId}`}
                        checked={provider.enabled}
                        onChange={() => toggleProvider(providerId)}
                        disabled={isLoading}
                        className="w-4 h-4"
                      />
                      <label
                        htmlFor={`provider-${providerId}`}
                        className={`font-medium ${provider.enabled ? 'text-gray-900' : 'text-gray-500'}`}
                      >
                        <span className="mr-1">{getProviderEmoji(providerId)}</span>
                        {provider.name}
                      </label>
                    </div>

                    {provider.enabled && (
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-600">权重:</label>
                        <input
                          type="number"
                          min="0"
                          max="2"
                          step="0.1"
                          value={provider.weight || 1.0}
                          onChange={(e) => updateProviderWeight(providerId, parseFloat(e.target.value))}
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                          disabled={isLoading}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 投票模式配置 */}
          <div>
            <h4 className="font-medium text-gray-700 mb-2">投票模式</h4>
            <div className="grid grid-cols-2 gap-2">
              {(['majority', 'weighted', 'expert-weighted', 'consensus', 'unanimous'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => onVotingConfigChange({
                    ...votingConfig,
                    mode,
                    expertProvider: ensureExpertProvider(mode),
                  })}
                  className={`px-3 py-2 rounded-lg text-sm font-medium text-left ${
                    votingConfig.mode === mode
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  disabled={isLoading}
                >
                  {getModeLabel(mode)}
                </button>
              ))}
            </div>
          </div>

          {votingConfig.mode === 'expert-weighted' && (
            <div>
              <h4 className="font-medium text-gray-700 mb-2">专家模型</h4>
              <select
                value={votingConfig.expertProvider || getEnabledProviders()[0] || 'claude'}
                onChange={(e) => onVotingConfigChange({
                  ...votingConfig,
                  expertProvider: e.target.value as AIProvider,
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                disabled={isLoading}
              >
                {getEnabledProviders().map((providerId) => (
                  <option key={providerId} value={providerId}>
                    {getProviderEmoji(providerId)} {providers[providerId].name}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-gray-500">
                专家模型的投票权重将按其基础权重的 3 倍计算。
              </p>
            </div>
          )}

          {/* 共识阈值 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              共识阈值: {votingConfig.threshold}
            </label>
            <input
              type="range"
              min="0.5"
              max="1.0"
              step="0.05"
              value={votingConfig.threshold}
              onChange={(e) => onVotingConfigChange({
                ...votingConfig,
                threshold: parseFloat(e.target.value),
              })}
              className="w-full"
              disabled={isLoading}
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0.5 (多数)</span>
              <span>1.0 (一致)</span>
            </div>
          </div>

          {/* 平局处理 */}
          <div>
            <h4 className="font-medium text-gray-700 mb-2">平局处理</h4>
            <div className="flex gap-2">
              {(['first', 'random', 'abstain'] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => onVotingConfigChange({
                    ...votingConfig,
                    tiebreaker: option,
                  })}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-medium ${
                    votingConfig.tiebreaker === option
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  disabled={isLoading}
                >
                  {option === 'first' ? '首选' : option === 'random' ? '随机' : '弃权'}
                </button>
              ))}
            </div>
          </div>

          {/* 说明 */}
          <div className="p-3 bg-purple-50 rounded text-xs text-purple-700">
            <p>🗳️ <strong>多AI投票:</strong></p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>启用多个AI模型会对每个问题进行投票</li>
              <li>投票模式决定如何计算获胜者</li>
              <li>权重可用于调整某些AI的影响力</li>
              <li>专家加权模式会将选定专家模型的权重提升为基础权重的 3 倍</li>
              <li>共识度低于阈值时会提示需要人工审查</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
