/**
 * 思维过程解析器
 * Thinking Process Parser
 *
 * 解析AI输出中的<thinking>标签
 */

import { ThinkingBlock } from '@/lib/types';

/**
 * 从内容中提取thinking块
 * Extract thinking blocks from content
 */
export function parseThinkingBlocks(content: string, messageId: string): ThinkingBlock[] {
  const blocks: ThinkingBlock[] = [];
  const regex = /<thinking>([\s\S]*?)<\/thinking>/g;
  let match;
  let order = 0;

  while ((match = regex.exec(content)) !== null) {
    blocks.push({
      id: `thinking-${Date.now()}-${order}`,
      messageId,
      content: match[1].trim(),
      order: order++,
      timestamp: Date.now(),
      source: 'explicit-tag',
    });
  }

  return blocks;
}

/**
 * 移除thinking标签，只保留最终答案
 * Remove thinking tags, keep only final answer
 */
export function removeThinkingTags(content: string): string {
  return content.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
}

/**
 * 检查内容是否包含thinking标签
 * Check if content contains thinking tags
 */
export function hasThinkingTags(content: string): boolean {
  return /<thinking>[\s\S]*?<\/thinking>/.test(content);
}

/**
 * 提取第一个thinking块
 * Extract first thinking block
 */
export function extractFirstThinking(content: string): string | null {
  const match = content.match(/<thinking>([\s\S]*?)<\/thinking>/);
  return match ? match[1].trim() : null;
}

/**
 * 高亮关键洞察
 * Highlight key insights in thinking content
 */
export function highlightKeyInsights(thinking: string): string {
  const insightKeywords = [
    // 中文关键词
    '关键洞察',
    '核心问题',
    '重要发现',
    '注意到',
    '意识到',
    '发现',
    // 英文关键词
    'key insight',
    'crucial point',
    'important',
    'realized',
    'noticed',
    'discovered',
    'found',
  ];

  let highlighted = thinking;

  insightKeywords.forEach(keyword => {
    const regex = new RegExp(`(${keyword}[^。\\n]*[。\\n])`, 'gi');
    highlighted = highlighted.replace(regex, '💡 $1');
  });

  return highlighted;
}

/**
 * 格式化thinking内容用于显示
 * Format thinking content for display
 */
export function formatThinkingForDisplay(
  thinking: string,
  options: {
    highlight?: boolean;
    maxLength?: number;
  } = {}
): string {
  const { highlight = false, maxLength } = options;

  let formatted = thinking;

  // 高亮关键洞察
  if (highlight) {
    formatted = highlightKeyInsights(formatted);
  }

  // 截断过长内容
  if (maxLength && formatted.length > maxLength) {
    formatted = formatted.substring(0, maxLength) + '...';
  }

  return formatted;
}

/**
 * 解析thinking中的步骤
 * Parse steps from thinking content
 */
export function parseThinkingSteps(thinking: string): string[] {
  const steps: string[] = [];

  // 尝试匹配编号列表
  const numberedListRegex = /^\d+\.\s+(.+)$/gm;
  const numberedMatches = thinking.match(numberedListRegex);
  if (numberedMatches) {
    steps.push(...numberedMatches.map(m => m.replace(/^\d+\.\s+/, '')));
  }

  // 尝试匹配bullet points
  const bulletListRegex = /^[-•]\s+(.+)$/gm;
  const bulletMatches = thinking.match(bulletListRegex);
  if (bulletMatches) {
    steps.push(...bulletMatches.map(m => m.replace(/^[-•]\s+/, '')));
  }

  // 如果都没有找到，按段落分割
  if (steps.length === 0) {
    const paragraphs = thinking.split(/\n\n+/);
    steps.push(...paragraphs.filter(p => p.trim().length > 0));
  }

  return steps;
}

/**
 * 计算thinking内容的复杂度
 * Calculate thinking complexity
 */
export function calculateThinkingComplexity(thinking: string): {
  steps: number;
  keywords: number;
  complexity: 'low' | 'medium' | 'high';
} {
  const steps = parseThinkingSteps(thinking);
  const keywordRegex = /分析|检查|验证|考虑|发现|注意到|realize|notice|discover|analyze|check|verify/gi;
  const keywordMatches = thinking.match(keywordRegex) || [];

  let complexity: 'low' | 'medium' | 'high';

  if (steps.length >= 5 || keywordMatches.length >= 10) {
    complexity = 'high';
  } else if (steps.length >= 3 || keywordMatches.length >= 5) {
    complexity = 'medium';
  } else {
    complexity = 'low';
  }

  return {
    steps: steps.length,
    keywords: keywordMatches.length,
    complexity,
  };
}
