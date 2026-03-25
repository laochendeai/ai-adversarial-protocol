/**
 * useVotingCalculation Hook
 * Memoized hook for expensive voting calculations
 *
 * This hook memoizes consensus computation and voting results
 * to avoid recalculating on every re-render when inputs haven't changed.
 */

import { useMemo } from 'react';
import { Vote, VotingResult, VotingConfig, AIProvider, AIProviderConfig } from '@/lib/types';
import { calculateVotingResult as calculateVotingResultRaw, getVotingSummary as getVotingSummaryRaw } from '@/lib/features/voting/calculator';

export interface VotingCalculationInput {
  votes: Vote[];
  options: string[];
  config: VotingConfig;
  providerConfigs: Record<AIProvider, AIProviderConfig>;
}

/**
 * Hook to memoize voting result calculation
 *
 * @param input - Voting data and configuration
 * @returns Memoized voting result
 */
export function useVotingResult(input: VotingCalculationInput): VotingResult | null {
  return useMemo(() => {
    if (!input.votes || input.votes.length === 0) {
      return null;
    }

    return calculateVotingResultRaw(
      input.votes,
      input.options,
      input.config,
      input.providerConfigs
    );
  }, [
    input.votes,
    input.options,
    input.config.mode,
    input.config.threshold,
    input.config.tiebreaker,
    input.providerConfigs,
  ]);
}

/**
 * Hook to memoize voting summary calculation
 *
 * @param result - Voting result (can be null)
 * @returns Memoized voting summary or null
 */
export function useVotingSummary(result: VotingResult | null) {
  return useMemo(() => {
    if (!result) {
      return null;
    }

    return getVotingSummaryRaw(result);
  }, [result?.winner, result?.consensusLevel, result?.totals, result?.votes.length]);
}

/**
 * Utility function to check if voting inputs have changed
 * Useful for dependency arrays in other hooks
 */
export function getVotingDeps(input: VotingCalculationInput): string {
  return JSON.stringify({
    voteCount: input.votes.length,
    choices: input.votes.map(v => v.choice).sort(),
    options: input.options.sort(),
    mode: input.config.mode,
    threshold: input.config.threshold,
    tiebreaker: input.config.tiebreaker,
  });
}
