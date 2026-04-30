/**
 * 自动挑刺解析器（重构后，对接新 Challenge 类型）
 */

import {
  Challenge,
  ChallengeSeverity,
  ChallengeType,
} from '@/lib/types';

const VALID_TYPES: readonly ChallengeType[] = [
  'factual-error',
  'logical-flaw',
  'omission',
  'unclear',
  'other',
] as const;

const VALID_SEVERITIES: readonly ChallengeSeverity[] = ['low', 'medium', 'high'] as const;

export interface ParseChallengeOptions {
  challengerId: string;
  targetId: string;
  threshold: number;        // 置信度阈值
}

/**
 * Yield each balanced top-level `{...}` substring in order. Skips braces
 * inside string literals. Lets the caller try-parse each candidate so that
 * if a model echoes the prompt's example (which may not itself be valid JSON,
 * e.g. `{"challenges": [...]}`) we can fall through to the real answer.
 */
function* iterJsonObjectCandidates(s: string): Generator<string> {
  let inString = false;
  let escape = false;
  let depth = 0;
  let start = -1;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        yield s.slice(start, i + 1);
        start = -1;
      }
    }
  }
}

export function parseChallengeResponse(
  response: string,
  options: ParseChallengeOptions
): { challenges: Challenge[]; error?: string } {
  const cleaned = response.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');

  let parsed: { challenges?: unknown[] } | null = null;
  let lastErr: string | null = null;
  let foundCandidate = false;
  for (const candidate of iterJsonObjectCandidates(cleaned)) {
    foundCandidate = true;
    try {
      const obj = JSON.parse(candidate);
      if (obj && typeof obj === 'object') {
        parsed = obj as { challenges?: unknown[] };
        break;
      }
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
    }
  }

  if (!foundCandidate) {
    return { challenges: [], error: 'No JSON object found in response' };
  }
  if (!parsed) {
    return {
      challenges: [],
      error: `JSON parse error: ${lastErr ?? 'no parseable object'}`,
    };
  }

  if (!Array.isArray(parsed.challenges)) {
    return { challenges: [], error: 'Missing or invalid challenges array' };
  }

  const now = Date.now();
  const result: Challenge[] = [];

  parsed.challenges.forEach((raw, idx) => {
    const c = raw as Record<string, unknown>;
    const type = c.type as ChallengeType;
    const severity = c.severity as ChallengeSeverity;
    const confidence = typeof c.confidence === 'number' ? c.confidence : 0;
    const targetSegment = typeof c.targetSegment === 'string' ? c.targetSegment : '';
    const reason = typeof c.reason === 'string' ? c.reason : '';

    if (!VALID_TYPES.includes(type)) return;
    if (!VALID_SEVERITIES.includes(severity)) return;
    if (confidence < options.threshold) return;
    if (!reason || reason.length > 500) return;
    if (targetSegment.length > 200) return;

    result.push({
      id: `chal-${options.challengerId}-${now}-${idx}`,
      challengerId: options.challengerId,
      targetId: options.targetId,
      type,
      severity,
      targetSegment,
      reason,
      confidence,
      status: 'pending',
      timestamp: now,
    });
  });

  return { challenges: result };
}

export function deduplicateChallenges(challenges: Challenge[]): Challenge[] {
  const seen = new Set<string>();
  return challenges.filter(c => {
    const key = `${c.targetId}|${c.targetSegment}|${c.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function limitChallenges(challenges: Challenge[], max: number): Challenge[] {
  // 优先保留高严重性 + 高置信度
  const sortOrder: Record<ChallengeSeverity, number> = { high: 3, medium: 2, low: 1 };
  const sorted = [...challenges].sort((a, b) => {
    const sev = sortOrder[b.severity] - sortOrder[a.severity];
    if (sev !== 0) return sev;
    return b.confidence - a.confidence;
  });
  return sorted.slice(0, max);
}

export function summarizeChallenges(challenges: Challenge[]): {
  total: number;
  byType: Record<ChallengeType, number>;
  bySeverity: Record<ChallengeSeverity, number>;
} {
  const byType: Record<ChallengeType, number> = {
    'factual-error': 0,
    'logical-flaw': 0,
    'omission': 0,
    'unclear': 0,
    'other': 0,
  };
  const bySeverity: Record<ChallengeSeverity, number> = { high: 0, medium: 0, low: 0 };
  challenges.forEach(c => {
    byType[c.type]++;
    bySeverity[c.severity]++;
  });
  return { total: challenges.length, byType, bySeverity };
}
