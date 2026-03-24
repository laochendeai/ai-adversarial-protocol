/**
 * 审计质量评分计算器
 * Audit Metrics Calculator
 */

import { AuditMetrics, Challenge } from '@/lib/types';

/**
 * 计算AI的可靠性评分 (0-100)
 * Calculate AI reliability score
 */
export function calculateReliabilityScore(metrics: AuditMetrics): number {
  // 基础分: 100
  let score = 100;

  // 如果没有足够的消息，返回N/A（用-1表示）
  if (metrics.totalMessages < 5) {
    return -1;  // 数据不足
  }

  // 被挑刺惩罚: 每被挑刺1次，扣3分
  const challengeRate = metrics.totalChallenges / metrics.totalMessages;
  score -= challengeRate * 30;

  // 严重性加权: 高严重性挑刺额外扣分
  if (metrics.totalChallenges > 0) {
    const severeRate = metrics.challengesBySeverity.high / metrics.totalChallenges;
    score -= severeRate * 20;
  }

  // 接受率惩罚: 被接受的挑刺再扣分
  if (metrics.totalChallenges > 0) {
    const acceptRate = metrics.acceptedChallenges / metrics.totalChallenges;
    score -= acceptRate * 10;
  }

  // 奖励: 如果很少被挑刺且输出较多，加分
  if (metrics.totalChallenges === 0 && metrics.totalMessages >= 10) {
    score = 100;  // 完美
  } else if (metrics.totalChallenges === 0 && metrics.totalMessages >= 5) {
    score = Math.max(score, 95);  // 优秀
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * 创建初始审计指标
 * Create initial audit metrics for an AI
 */
export function createInitialMetrics(aiId: string): AuditMetrics {
  return {
    aiId,
    totalMessages: 0,
    totalChallenges: 0,
    challengesByType: {
      factualError: 0,
      logicalFlaw: 0,
      omission: 0,
      unclear: 0,
      other: 0,
    },
    challengesBySeverity: {
      high: 0,
      medium: 0,
      low: 0,
    },
    acceptedChallenges: 0,
    rejectedChallenges: 0,
    reliabilityScore: 100,  // 初始满分
    lastUpdated: Date.now(),
  };
}

/**
 * 记录新的消息（增加消息计数）
 * Record a new message from an AI
 */
export function recordMessage(metrics: AuditMetrics): AuditMetrics {
  return {
    ...metrics,
    totalMessages: metrics.totalMessages + 1,
    lastUpdated: Date.now(),
  };
}

/**
 * 记录新的挑刺
 * Record a new challenge against an AI
 */
export function recordChallenge(
  metrics: AuditMetrics,
  challenge: Challenge
): AuditMetrics {
  const updated = {
    ...metrics,
    totalChallenges: metrics.totalChallenges + 1,
    lastUpdated: Date.now(),
  };

  // 更新类型统计
  if (challenge.challengeType) {
    updated.challengesByType = {
      ...metrics.challengesByType,
      [getTypeKey(challenge.challengeType)]:
        metrics.challengesByType[getTypeKey(challenge.challengeType)] + 1,
    };
  }

  // 更新严重性统计
  if (challenge.severity) {
    updated.challengesBySeverity = {
      ...metrics.challengesBySeverity,
      [challenge.severity]: metrics.challengesBySeverity[challenge.severity] + 1,
    };
  }

  // 重新计算评分
  updated.reliabilityScore = calculateReliabilityScore(updated);

  return updated;
}

/**
 * 记录挑刺结果（接受/拒绝）
 * Record challenge outcome
 */
export function recordChallengeOutcome(
  metrics: AuditMetrics,
  outcome: 'accepted' | 'rejected'
): AuditMetrics {
  const updated = { ...metrics };

  if (outcome === 'accepted') {
    updated.acceptedChallenges = metrics.acceptedChallenges + 1;
  } else {
    updated.rejectedChallenges = metrics.rejectedChallenges + 1;
  }

  updated.lastUpdated = Date.now();

  // 重新计算评分
  updated.reliabilityScore = calculateReliabilityScore(updated);

  return updated;
}

/**
 * 获取评分等级描述
 * Get score grade description
 */
export function getScoreGrade(score: number): {
  grade: string;
  color: string;
  description: string;
} {
  if (score === -1) {
    return {
      grade: 'N/A',
      color: 'gray',
      description: '数据不足',
    };
  }

  if (score >= 90) {
    return {
      grade: 'A+',
      color: 'green',
      description: '优秀',
    };
  } else if (score >= 80) {
    return {
      grade: 'A',
      color: 'green',
      description: '良好',
    };
  } else if (score >= 70) {
    return {
      grade: 'B',
      color: 'yellow',
      description: '中等',
    };
  } else if (score >= 60) {
    return {
      grade: 'C',
      color: 'orange',
      description: '及格',
    };
  } else {
    return {
      grade: 'D',
      color: 'red',
      description: '需改进',
    };
  }
}

/**
 * 辅助函数: 类型映射
 */
function getTypeKey(type: Challenge['challengeType']): keyof AuditMetrics['challengesByType'] {
  if (!type) return 'other';
  const typeMap: Record<string, keyof AuditMetrics['challengesByType']> = {
    'factual-error': 'factualError',
    'logical-flaw': 'logicalFlaw',
    'omission': 'omission',
    'unclear': 'unclear',
  };
  return typeMap[type] || 'other';
}
