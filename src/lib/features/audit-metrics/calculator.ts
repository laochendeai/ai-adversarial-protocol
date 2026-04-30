/**
 * 审计质量评分计算器
 */

import { AuditMetrics, Challenge, ChallengeType, ChallengeSeverity } from '@/lib/types';

export function createInitialMetrics(modelId: string): AuditMetrics {
  return {
    modelId,
    totalMessages: 0,
    totalChallenges: 0,
    challengesByType: {
      'factual-error': 0,
      'logical-flaw': 0,
      'omission': 0,
      'unclear': 0,
      'other': 0,
    },
    challengesBySeverity: {
      high: 0,
      medium: 0,
      low: 0,
    },
    acceptedChallenges: 0,
    rejectedChallenges: 0,
    reliabilityScore: 100,
    lastUpdated: Date.now(),
  };
}

/**
 * 评分算法（0-100，-1 = 数据不足）
 */
export function calculateReliabilityScore(metrics: AuditMetrics): number {
  if (metrics.totalMessages < 5) return -1;

  let score = 100;
  const challengeRate = metrics.totalChallenges / metrics.totalMessages;
  score -= challengeRate * 30;

  if (metrics.totalChallenges > 0) {
    const severeRate = metrics.challengesBySeverity.high / metrics.totalChallenges;
    score -= severeRate * 20;

    const acceptRate = metrics.acceptedChallenges / metrics.totalChallenges;
    score -= acceptRate * 10;
  }

  if (metrics.totalChallenges === 0 && metrics.totalMessages >= 10) score = 100;
  else if (metrics.totalChallenges === 0 && metrics.totalMessages >= 5) score = Math.max(score, 95);

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function recordMessage(metrics: AuditMetrics): AuditMetrics {
  return {
    ...metrics,
    totalMessages: metrics.totalMessages + 1,
    lastUpdated: Date.now(),
  };
}

export function recordChallenge(
  metrics: AuditMetrics,
  challenge: Challenge
): AuditMetrics {
  const updated: AuditMetrics = {
    ...metrics,
    totalChallenges: metrics.totalChallenges + 1,
    challengesByType: { ...metrics.challengesByType },
    challengesBySeverity: { ...metrics.challengesBySeverity },
    lastUpdated: Date.now(),
  };

  const type: ChallengeType = challenge.type ?? 'other';
  updated.challengesByType[type] = (updated.challengesByType[type] ?? 0) + 1;

  const severity: ChallengeSeverity = challenge.severity ?? 'medium';
  updated.challengesBySeverity[severity] = (updated.challengesBySeverity[severity] ?? 0) + 1;

  updated.reliabilityScore = calculateReliabilityScore(updated);
  return updated;
}

export function recordChallengeOutcome(
  metrics: AuditMetrics,
  outcome: 'accepted' | 'rejected'
): AuditMetrics {
  const updated: AuditMetrics = {
    ...metrics,
    acceptedChallenges:
      outcome === 'accepted' ? metrics.acceptedChallenges + 1 : metrics.acceptedChallenges,
    rejectedChallenges:
      outcome === 'rejected' ? metrics.rejectedChallenges + 1 : metrics.rejectedChallenges,
    lastUpdated: Date.now(),
  };
  updated.reliabilityScore = calculateReliabilityScore(updated);
  return updated;
}

export function getScoreGrade(score: number): {
  grade: string;
  color: 'gray' | 'green' | 'yellow' | 'orange' | 'red';
  description: string;
} {
  if (score === -1) return { grade: 'N/A', color: 'gray', description: '数据不足' };
  if (score >= 90) return { grade: 'A+', color: 'green', description: '优秀' };
  if (score >= 80) return { grade: 'A', color: 'green', description: '良好' };
  if (score >= 70) return { grade: 'B', color: 'yellow', description: '中等' };
  if (score >= 60) return { grade: 'C', color: 'orange', description: '及格' };
  return { grade: 'D', color: 'red', description: '需改进' };
}
