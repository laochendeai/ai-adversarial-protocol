/**
 * 思维过程显示组件
 * Thinking Process Display Component
 *
 * 显示AI的thinking块内容
 */

'use client';

import { useState } from 'react';
import { ThinkingBlock } from '@/lib/types';
import {
  formatThinkingForDisplay,
  parseThinkingSteps,
  calculateThinkingComplexity,
} from '@/lib/features/thinking-visualization';

interface ThinkingBlockDisplayProps {
  block: ThinkingBlock;
  displayMode?: 'inline' | 'compact' | 'detailed';
  highlight?: boolean;
  showSteps?: boolean;
}

export default function ThinkingBlockDisplay({
  block,
  displayMode = 'inline',
  highlight = true,
  showSteps = true,
}: ThinkingBlockDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // 计算复杂度
  const complexity = calculateThinkingComplexity(block.content);

  // 解析步骤
  const steps = showSteps ? parseThinkingSteps(block.content) : [];

  // 格式化内容
  const formattedContent = formatThinkingForDisplay(block.content, {
    highlight,
  });

  // 获取复杂度颜色
  const getComplexityColor = () => {
    switch (complexity.complexity) {
      case 'high':
        return 'bg-purple-100 border-purple-300 text-purple-700';
      case 'medium':
        return 'bg-blue-100 border-blue-300 text-blue-700';
      case 'low':
        return 'bg-gray-100 border-gray-300 text-gray-700';
      default:
        return 'bg-gray-100 border-gray-300 text-gray-700';
    }
  };

  // 获取复杂度标签
  const getComplexityLabel = () => {
    switch (complexity.complexity) {
      case 'high':
        return '复杂';
      case 'medium':
        return '中等';
      case 'low':
        return '简单';
      default:
        return '未知';
    }
  };

  if (displayMode === 'compact') {
    return (
      <div className="mb-2 p-2 bg-gray-50 rounded border border-gray-200 text-sm">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-gray-500">🧠 思维过程</span>
          <span className={`px-2 py-0.5 rounded text-xs ${getComplexityColor()}`}>
            {getComplexityLabel()}
          </span>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-blue-500 hover:text-blue-700 text-xs ml-auto"
          >
            {isExpanded ? '收起' : '展开'}
          </button>
        </div>
        {isExpanded && (
          <div className="text-gray-700 whitespace-pre-wrap">{formattedContent}</div>
        )}
      </div>
    );
  }

  if (displayMode === 'detailed') {
    return (
      <div className="mb-4 p-4 bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg border-2 border-purple-200">
        {/* 标题栏 */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🧠</span>
            <span className="font-bold text-gray-800">思维过程</span>
            <span className={`px-2 py-1 rounded text-xs font-medium ${getComplexityColor()}`}>
              {getComplexityLabel()} ({complexity.steps} 步骤)
            </span>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-500 hover:text-gray-700"
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        </div>

        {isExpanded && (
          <>
            {/* 内容 */}
            <div className="bg-white rounded p-3 mb-3 border border-gray-200">
              <div className="prose prose-sm max-w-none whitespace-pre-wrap text-gray-700">
                {formattedContent}
              </div>
            </div>

            {/* 步骤列表 */}
            {steps.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-600 mb-2">步骤分解：</div>
                {steps.map((step, i) => (
                  <div
                    key={i}
                    className="flex gap-2 text-sm p-2 bg-white rounded border border-gray-200"
                  >
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                      {i + 1}
                    </span>
                    <span className="text-gray-700">{step}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // Inline mode (default)
  return (
    <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-2 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center gap-2">
          <span className="text-lg">🧠</span>
          <span className="font-medium text-gray-800">思维过程</span>
          {complexity.steps > 0 && (
            <span className="text-xs text-gray-500">({complexity.steps} 步骤)</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded text-xs ${getComplexityColor()}`}>
            {getComplexityLabel()}
          </span>
          <span className="text-gray-400">{isExpanded ? '▼' : '▶'}</span>
        </div>
      </div>

      {isExpanded && (
        <div className="bg-white rounded p-2 text-sm text-gray-700 whitespace-pre-wrap border border-gray-200">
          {formattedContent}
        </div>
      )}
    </div>
  );
}
