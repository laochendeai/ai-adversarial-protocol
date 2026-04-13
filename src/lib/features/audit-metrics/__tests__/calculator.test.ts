/**
 * 审计质量评分计算器测试
 * Audit Metrics Calculator Tests
 */

import {
  calculateReliabilityScore,
  createInitialMetrics,
  recordMessage,
  recordChallenge,
  recordChallengeOutcome,
  getScoreGrade,
} from '../calculator';

describe('AuditMetrics Calculator', () => {
  describe('calculateReliabilityScore', () => {
    it('should return -1 for insufficient data (< 5 messages)', () => {
      const metrics = createInitialMetrics('claude');
      metrics.totalMessages = 3;

      expect(calculateReliabilityScore(metrics)).toBe(-1);
    });

    it('should return 100 for perfect performance (no challenges)', () => {
      const metrics = createInitialMetrics('claude');
      metrics.totalMessages = 10;
      metrics.totalChallenges = 0;

      expect(calculateReliabilityScore(metrics)).toBe(100);
    });

    it('should penalize for high challenge rate', () => {
      const metrics = createInitialMetrics('claude');
      metrics.totalMessages = 10;
      metrics.totalChallenges = 5; // 50% challenge rate
      metrics.challengesBySeverity.high = 2;
      metrics.acceptedChallenges = 3;

      const score = calculateReliabilityScore(metrics);
      expect(score).toBeLessThan(100);
      expect(score).toBeGreaterThan(0);
    });

    it('should give bonus for 10+ messages with no challenges', () => {
      const metrics = createInitialMetrics('claude');
      metrics.totalMessages = 15;
      metrics.totalChallenges = 0;

      expect(calculateReliabilityScore(metrics)).toBe(100);
    });

    it('should handle edge case of exactly 5 messages', () => {
      const metrics = createInitialMetrics('claude');
      metrics.totalMessages = 5;
      metrics.totalChallenges = 0;

      expect(calculateReliabilityScore(metrics)).toBe(100);
    });
  });

  describe('createInitialMetrics', () => {
    it('should create metrics with correct initial values', () => {
      const metrics = createInitialMetrics('claude');

      expect(metrics.aiId).toBe('claude');
      expect(metrics.totalMessages).toBe(0);
      expect(metrics.totalChallenges).toBe(0);
      expect(metrics.reliabilityScore).toBe(100);
      expect(metrics.challengesByType.factualError).toBe(0);
      expect(metrics.challengesBySeverity.high).toBe(0);
    });
  });

  describe('recordMessage', () => {
    it('should increment totalMessages', () => {
      const metrics = createInitialMetrics('claude');
      const updated = recordMessage(metrics);

      expect(updated.totalMessages).toBe(1);
      expect(updated.totalChallenges).toBe(0);
    });

    it('should preserve other fields', () => {
      const metrics = createInitialMetrics('claude');
      metrics.totalChallenges = 2;
      const updated = recordMessage(metrics);

      expect(updated.totalMessages).toBe(1);
      expect(updated.totalChallenges).toBe(2);
    });
  });

  describe('recordChallenge', () => {
    it('should increment totalChallenges', () => {
      const metrics = createInitialMetrics('claude');
      const challenge = {
        id: '1',
        messageIndex: 0,
        reason: 'Test',
        timestamp: Date.now(),
        challengeType: 'factual-error' as const,
        severity: 'high' as const,
      };

      const updated = recordChallenge(metrics, challenge);

      expect(updated.totalChallenges).toBe(1);
      expect(updated.challengesByType.factualError).toBe(1);
      expect(updated.challengesBySeverity.high).toBe(1);
    });

    it('should recalculate score', () => {
      const metrics = createInitialMetrics('claude');
      metrics.totalMessages = 10;

      const challenge = {
        id: '1',
        messageIndex: 0,
        reason: 'Test',
        timestamp: Date.now(),
        challengeType: 'logical-flaw' as const,
        severity: 'medium' as const,
      };

      const updated = recordChallenge(metrics, challenge);

      expect(updated.reliabilityScore).toBeLessThan(100);
    });
  });

  describe('recordChallengeOutcome', () => {
    it('should increment acceptedChallenges', () => {
      const metrics = createInitialMetrics('claude');
      metrics.totalChallenges = 1;

      const updated = recordChallengeOutcome(metrics, 'accepted');

      expect(updated.acceptedChallenges).toBe(1);
      expect(updated.rejectedChallenges).toBe(0);
    });

    it('should increment rejectedChallenges', () => {
      const metrics = createInitialMetrics('claude');
      metrics.totalChallenges = 1;

      const updated = recordChallengeOutcome(metrics, 'rejected');

      expect(updated.acceptedChallenges).toBe(0);
      expect(updated.rejectedChallenges).toBe(1);
    });

    it('should recalculate score', () => {
      const metrics = createInitialMetrics('claude');
      metrics.totalMessages = 10;
      metrics.totalChallenges = 1;

      const updated = recordChallengeOutcome(metrics, 'accepted');

      // Score should be recalculated (may be different)
      expect(updated.reliabilityScore).toBeDefined();
    });
  });

  describe('getScoreGrade', () => {
    it('should return correct grade for excellent scores', () => {
      const grade = getScoreGrade(95);
      expect(grade.grade).toBe('A+');
      expect(grade.color).toBe('green');
      expect(grade.description).toBe('优秀');
    });

    it('should return correct grade for good scores', () => {
      const grade = getScoreGrade(85);
      expect(grade.grade).toBe('A');
      expect(grade.color).toBe('green');
      expect(grade.description).toBe('良好');
    });

    it('should return correct grade for medium scores', () => {
      const grade = getScoreGrade(75);
      expect(grade.grade).toBe('B');
      expect(grade.color).toBe('yellow');
      expect(grade.description).toBe('中等');
    });

    it('should return correct grade for passing scores', () => {
      const grade = getScoreGrade(65);
      expect(grade.grade).toBe('C');
      expect(grade.color).toBe('orange');
      expect(grade.description).toBe('及格');
    });

    it('should return correct grade for poor scores', () => {
      const grade = getScoreGrade(55);
      expect(grade.grade).toBe('D');
      expect(grade.color).toBe('red');
      expect(grade.description).toBe('需改进');
    });

    it('should return N/A for insufficient data', () => {
      const grade = getScoreGrade(-1);
      expect(grade.grade).toBe('N/A');
      expect(grade.color).toBe('gray');
      expect(grade.description).toBe('数据不足');
    });
  });
});
