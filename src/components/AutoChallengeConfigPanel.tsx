/**
 * 自动挑刺配置面板
 * Auto-Challenge Config Panel
 */

'use client';

import { useState } from 'react';
import { AutoChallengeConfig } from '@/lib/types';

interface AutoChallengeConfigPanelProps {
  config: AutoChallengeConfig;
  onConfigChange: (config: AutoChallengeConfig) => void;
  isLoading?: boolean;
}

export default function AutoChallengeConfigPanel({
  config,
  onConfigChange,
  isLoading = false,
}: AutoChallengeConfigPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggle = () => {
    onConfigChange({
      ...config,
      enabled: !config.enabled,
    });
  };

  const handleThresholdChange = (threshold: number) => {
    onConfigChange({
      ...config,
      threshold,
    });
  };

  const handleMaxChallengesChange = (max: number) => {
    onConfigChange({
      ...config,
      maxChallengesPerRound: max,
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-4">
      {/* 标题栏 */}
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">🤖</span>
          <span className="font-medium text-gray-700">
            自动挑刺
            {config.enabled && <span className="ml-2 text-green-500">(已启用)</span>}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleToggle();
            }}
            className={`px-3 py-1 rounded-lg text-sm font-medium ${
              config.enabled
                ? 'bg-green-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            disabled={isLoading}
          >
            {config.enabled ? '✓ 已启用' : '启用'}
          </button>
          <button className="text-gray-400 hover:text-gray-600">
            {isExpanded ? '▼' : '▶'}
          </button>
        </div>
      </div>

      {/* 详细配置 */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
          {/* 置信度阈值 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              置信度阈值: {config.threshold}
            </label>
            <input
              type="range"
              min="0.5"
              max="1.0"
              step="0.05"
              value={config.threshold}
              onChange={(e) => handleThresholdChange(parseFloat(e.target.value))}
              className="w-full"
              disabled={isLoading}
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0.5 (宽松)</span>
              <span>1.0 (严格)</span>
            </div>
          </div>

          {/* 最大挑刺数 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              每轮最多挑刺: {config.maxChallengesPerRound} 次
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 5, 10].map((max) => (
                <button
                  key={max}
                  onClick={() => handleMaxChallengesChange(max)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                    config.maxChallengesPerRound === max
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  disabled={isLoading}
                >
                  {max}
                </button>
              ))}
            </div>
          </div>

          {/* 说明 */}
          <div className="p-2 bg-purple-50 rounded text-xs text-purple-700">
            <p>🤖 <strong>自动挑刺:</strong></p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>两个AI完成响应后自动互相审计</li>
              <li>只挑刺确信有问题的地方（&gt;{config.threshold}置信度）</li>
              <li>每轮最多{config.maxChallengesPerRound}条挑刺</li>
              <li>可以手动接受、忽略或展开辩论</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
