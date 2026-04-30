import { describe, it, expect } from 'vitest';
import {
  createInitialMetrics,
  calculateReliabilityScore,
  recordMessage,
  recordChallenge,
  recordChallengeOutcome,
  getScoreGrade,
} from '../calculator';
import { Challenge } from '@/lib/types';

function challenge(severity: Challenge['severity'], type: Challenge['type'] = 'factual-error'): Challenge {
  return {
    id: 'c1',
    challengerId: 'x',
    targetId: 'y',
    type,
    severity,
    targetSegment: '',
    reason: '',
    confidence: 0.9,
    status: 'pending',
    timestamp: 0,
  };
}

describe('audit-metrics calculator', () => {
  it('starts at 100 with no data', () => {
    const m = createInitialMetrics('model-x');
    expect(m.reliabilityScore).toBe(100);
    expect(m.modelId).toBe('model-x');
  });

  it("returns -1 when fewer than 5 messages have been seen", () => {
    let m = createInitialMetrics('m');
    for (let i = 0; i < 4; i++) m = recordMessage(m);
    expect(calculateReliabilityScore(m)).toBe(-1);
  });

  it('penalises high challenge rate and severe challenges', () => {
    let clean = createInitialMetrics('clean');
    for (let i = 0; i < 10; i++) clean = recordMessage(clean);
    const cleanScore = calculateReliabilityScore(clean);

    let dirty = createInitialMetrics('dirty');
    for (let i = 0; i < 10; i++) dirty = recordMessage(dirty);
    for (let i = 0; i < 5; i++) dirty = recordChallenge(dirty, challenge('high'));

    expect(cleanScore).toBe(100);
    expect(dirty.reliabilityScore).toBeLessThan(cleanScore);
  });

  it('records type and severity buckets', () => {
    let m = createInitialMetrics('m');
    for (let i = 0; i < 10; i++) m = recordMessage(m);
    m = recordChallenge(m, challenge('high', 'factual-error'));
    m = recordChallenge(m, challenge('low', 'omission'));
    expect(m.challengesByType['factual-error']).toBe(1);
    expect(m.challengesByType['omission']).toBe(1);
    expect(m.challengesBySeverity.high).toBe(1);
    expect(m.challengesBySeverity.low).toBe(1);
    expect(m.totalChallenges).toBe(2);
  });

  it('counts accepted vs rejected outcomes', () => {
    let m = createInitialMetrics('m');
    for (let i = 0; i < 10; i++) m = recordMessage(m);
    m = recordChallenge(m, challenge('high'));
    m = recordChallengeOutcome(m, 'accepted');
    m = recordChallengeOutcome(m, 'rejected');
    expect(m.acceptedChallenges).toBe(1);
    expect(m.rejectedChallenges).toBe(1);
  });

  it('maps score to grade buckets', () => {
    expect(getScoreGrade(-1).grade).toBe('N/A');
    expect(getScoreGrade(95).grade).toBe('A+');
    expect(getScoreGrade(85).grade).toBe('A');
    expect(getScoreGrade(75).grade).toBe('B');
    expect(getScoreGrade(65).grade).toBe('C');
    expect(getScoreGrade(40).grade).toBe('D');
  });
});
