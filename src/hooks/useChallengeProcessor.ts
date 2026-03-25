/**
 * useChallengeProcessor Hook
 * Memoized hook for challenge processing operations
 *
 * This hook memoizes expensive challenge parsing operations like
 * deduplication, sorting, filtering, and summary calculation.
 */

import { useMemo } from 'react';
import { Challenge } from '@/lib/types';
import {
  deduplicateChallenges as deduplicateChallengesRaw,
  sortChallenges as sortChallengesRaw,
  filterValidChallenges as filterValidChallengesRaw,
  calculateChallengeSummary as calculateChallengeSummaryRaw,
} from '@/lib/features/auto-challenge/parser';

export interface ChallengeProcessorInput {
  challenges: Challenge[];
  maxChallenges?: number;
}

export interface ChallengeProcessorOutput {
  /**
   * Deduplicated challenges
   */
  deduplicated: Challenge[];

  /**
   * Sorted challenges (by severity, then confidence)
   */
  sorted: Challenge[];

  /**
   * Valid challenges only
   */
  valid: Challenge[];

  /**
   * Limited to maxChallenges
   */
  limited: Challenge[];

  /**
   * Fully processed: deduplicated → sorted → filtered → limited
   */
  processed: Challenge[];

  /**
   * Challenge statistics summary
   */
  summary: {
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
  };
}

/**
 * Hook to memoize challenge processing pipeline
 *
 * @param input - Challenges and processing options
 * @returns Memoized processing results
 */
export function useChallengeProcessor(input: ChallengeProcessorInput): ChallengeProcessorOutput {
  const { challenges, maxChallenges } = input;

  return useMemo(() => {
    // Step 1: Deduplicate
    const deduplicated = deduplicateChallengesRaw(challenges);

    // Step 2: Sort by severity
    const sorted = sortChallengesRaw(deduplicated);

    // Step 3: Filter valid challenges
    const valid = filterValidChallengesRaw(sorted);

    // Step 4: Limit to max challenges
    const limited = maxChallenges ? valid.slice(0, maxChallenges) : valid;

    // Calculate summary
    const summary = calculateChallengeSummaryRaw(limited);

    return {
      deduplicated,
      sorted,
      valid,
      limited,
      processed: limited,
      summary,
    };
  }, [challenges, maxChallenges]);
}

/**
 * Hook to memoize only deduplication
 */
export function useDeduplicatedChallenges(challenges: Challenge[]): Challenge[] {
  return useMemo(() => {
    return deduplicateChallengesRaw(challenges);
  }, [challenges]);
}

/**
 * Hook to memoize only sorting
 */
export function useSortedChallenges(challenges: Challenge[]): Challenge[] {
  return useMemo(() => {
    return sortChallengesRaw(challenges);
  }, [challenges]);
}

/**
 * Hook to memoize only validation
 */
export function useValidChallenges(challenges: Challenge[]): Challenge[] {
  return useMemo(() => {
    return filterValidChallengesRaw(challenges);
  }, [challenges]);
}

/**
 * Hook to memoize only summary calculation
 */
export function useChallengeSummary(challenges: Challenge[]) {
  return useMemo(() => {
    return calculateChallengeSummaryRaw(challenges);
  }, [challenges]);
}

/**
 * Utility to generate a stable key for challenge array
 * Useful for dependency arrays in other hooks
 */
export function getChallengeKey(challenges: Challenge[]): string {
  return JSON.stringify(
    challenges.map(c => ({
      id: c.id,
      type: c.challengeType,
      severity: c.severity,
      target: c.targetSegment?.substring(0, 50),
    }))
  );
}
