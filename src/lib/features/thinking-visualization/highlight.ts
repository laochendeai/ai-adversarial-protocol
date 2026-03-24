/**
 * 思维过程高亮工具
 * Thinking Process Highlighting Tools
 */

import { formatThinkingForDisplay } from './parser';

/**
 * 关键词配置
 */
const INSIGHT_KEYWORDS = {
  chinese: [
    { pattern: /关键洞察[^。\n]*/g, emoji: '💡', priority: 1 },
    { pattern: /核心问题[^。\n]*/g, emoji: '🎯', priority: 2 },
    { pattern: /重要发现[^。\n]*/g, emoji: '✨', priority: 3 },
    { pattern: /意识到[^。\n]*/g, emoji: '🤔', priority: 4 },
    { pattern: /注意到[^。\n]*/g, emoji: '👀', priority: 5 },
  ],
  english: [
    { pattern: /key insight[^.\n]*/gi, emoji: '💡', priority: 1 },
    { pattern: /crucial point[^.\n]*/gi, emoji: '🎯', priority: 2 },
    { pattern: /important[^.\n]*/gi, emoji: '✨', priority: 3 },
    { pattern: /realized[^.\n]*/gi, emoji: '🤔', priority: 4 },
    { pattern: /noticed[^.\n]*/gi, emoji: '👀', priority: 5 },
  ],
};

/**
 * 高亮关键洞察（带emoji）
 */
export function highlightInsightsWithEmoji(thinking: string): string {
  let result = thinking;

  // 合并所有关键词模式
  const allPatterns = [...INSIGHT_KEYWORDS.chinese, ...INSIGHT_KEYWORDS.english];

  // 按优先级排序
  allPatterns.sort((a, b) => a.priority - b.priority);

  // 应用高亮（避免重复替换）
  const processed = new Set<string>();

  allPatterns.forEach(({ pattern, emoji }) => {
    result = result.replace(pattern, (match) => {
      if (!processed.has(match)) {
        processed.add(match);
        return `${emoji} ${match}`;
      }
      return match;
    });
  });

  return result;
}

/**
 * 高亮关键步骤（带编号）
 */
export function highlightSteps(thinking: string): string {
  const lines = thinking.split('\n');
  let stepNumber = 0;

  return lines
    .map(line => {
      // 检测是否是步骤行（以数字或符号开头）
      const stepMatch = line.match(/^[\d\-\•]+[\.\)]?\s*(.+)/);
      if (stepMatch) {
        stepNumber++;
        return `${stepNumber}. ${stepMatch[1]}`;
      }

      // 检测是否是包含步骤关键词的行
      const stepKeyword = line.match(/^(?:步骤|step|第?\d步?)\s*:?\s*(.+)/i);
      if (stepKeyword) {
        return `📍 ${stepKeyword[1]}`;
      }

      return line;
    })
    .join('\n');
}

/**
 * 高亮重要关键词
 */
export function highlightKeywords(thinking: string): string {
  const keywordMap: Record<string, string> = {
    '分析': '🔍',
    '检查': '✔️',
    '验证': '✅',
    '考虑': '🤔',
    '发现': '💡',
    '注意到': '👀',
    '问题': '❓',
    '错误': '❌',
    '正确': '✅',
    // English
    'analyze': '🔍',
    'check': '✔️',
    'verify': '✅',
    'consider': '🤔',
    'discover': '💡',
    'notice': '👀',
    'question': '❓',
    'error': '❌',
    'correct': '✅',
  };

  let result = thinking;

  Object.entries(keywordMap).forEach(([keyword, emoji]) => {
    const regex = new RegExp(`\\b(${keyword})\\b`, 'gi');
    result = result.replace(regex, `${emoji} $1`);
  });

  return result;
}

/**
 * 组合高亮（emoji + 步骤 + 关键词）
 */
export function applyCombinedHighlighting(thinking: string): string {
  let result = thinking;

  // 1. 高亮关键洞察
  result = highlightInsightsWithEmoji(result);

  // 2. 高亮步骤
  result = highlightSteps(result);

  // 3. 高亮关键词
  result = highlightKeywords(result);

  return result;
}

/**
 * 获取思维摘要（用于预览）
 */
export function getThinkingSummary(thinking: string, maxLength: number = 100): string {
  // 尝试提取第一句话或第一个步骤
  const firstSentence = thinking.match(/^(.+?)[。.\n]/);
  if (firstSentence) {
    const summary = firstSentence[1].trim();
    return summary.length <= maxLength
      ? summary
      : summary.substring(0, maxLength - 3) + '...';
  }

  // 如果没有句子分隔符，直接截断
  return thinking.length <= maxLength
    ? thinking
    : thinking.substring(0, maxLength - 3) + '...';
}

/**
 * 格式化thinking为HTML
 */
export function formatThinkingAsHTML(thinking: string, options: {
  highlight?: boolean;
  showSteps?: boolean;
} = {}): string {
  const { highlight = true, showSteps = true } = options;

  let formatted = thinking;

  if (highlight) {
    formatted = applyCombinedHighlighting(formatted);
  }

  if (showSteps) {
    const steps = formatted.split(/\n\n+/);
    formatted = steps.map((step, i) => `<p><strong>Step ${i + 1}:</strong> ${step}</p>`).join('\n');
  }

  return formatted;
}

/**
 * 检测thinking内容的类型
 */
export function detectThinkingType(thinking: string): {
  type: 'analysis' | 'planning' | 'reasoning' | 'other';
  confidence: number;
} {
  const analysis = thinking.match(/分析|analyze|检查|check/gi);
  const planning = thinking.match(/计划|plan|步骤|step|首先|first/gi);
  const reasoning = thinking.match(/推理|reason|因为|because|所以|therefore/gi);

  const counts = {
    analysis: analysis?.length || 0,
    planning: planning?.length || 0,
    reasoning: reasoning?.length || 0,
  };

  const maxCount = Math.max(counts.analysis, counts.planning, counts.reasoning);

  if (maxCount === 0) {
    return { type: 'other', confidence: 0 };
  }

  if (counts.analysis === maxCount) {
    return { type: 'analysis', confidence: maxCount / 10 };
  } else if (counts.planning === maxCount) {
    return { type: 'planning', confidence: maxCount / 10 };
  } else {
    return { type: 'reasoning', confidence: maxCount / 10 };
  }
}
