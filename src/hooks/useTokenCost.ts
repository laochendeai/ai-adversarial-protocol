/**
 * useTokenCost Hook
 * Memoized hook for calculating token costs
 *
 * This hook memoizes token cost calculations to avoid recalculating
 * on every re-render when inputs haven't changed.
 */

import { useMemo } from 'react';

export interface TokenCostInput {
  inputTokens: number;
  outputTokens: number;
  provider: 'claude' | 'openai' | 'gemini' | 'local';
  model?: string;
}

export interface TokenCostResult {
  totalTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: string;
}

/**
 * Pricing per million tokens (as of 2025)
 * Source: Provider pricing pages
 */
const PRICING = {
  claude: {
    sonnet: { input: 3.0, output: 15.0 },
    opus: { input: 15.0, output: 75.0 },
    haiku: { input: 0.25, output: 1.25 },
  },
  openai: {
    'gpt-4o': { input: 2.50, output: 10.0 },
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    'gpt-4-turbo': { input: 10.0, output: 30.0 },
  },
  gemini: {
    'gemini-pro': { input: 0.50, output: 1.50 },
    'gemini-flash': { input: 0.075, output: 0.30 },
  },
  local: {
    // Ollama/local models are free
    default: { input: 0, output: 0 },
  },
} as const;

/**
 * Get pricing for a provider and model
 */
function getPricing(provider: string, model?: string): { input: number; output: number } {
  if (provider === 'local') {
    return PRICING.local.default;
  }

  const providerPricing = PRICING[provider as keyof typeof PRICING];
  if (!providerPricing) {
    // Default to reasonable fallback if unknown provider
    return { input: 1.0, output: 2.0 };
  }

  // If model is specified, try to find exact match
  if (model) {
    const modelPricing = providerPricing[model as keyof typeof providerPricing];
    if (modelPricing) {
      return modelPricing;
    }
  }

  // Fallback to first available pricing for this provider
  const firstModel = Object.values(providerPricing)[0];
  return firstModel || { input: 1.0, output: 2.0 };
}

/**
 * Hook to memoize token cost calculations
 *
 * @param input - Token usage and provider info
 * @returns Memoized cost breakdown
 */
export function useTokenCost(input: TokenCostInput): TokenCostResult {
  return useMemo(() => {
    const { inputTokens, outputTokens, provider, model } = input;

    // Get pricing for this provider/model
    const pricing = getPricing(provider, model);

    // Calculate costs (pricing is per million tokens)
    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;
    const totalCost = inputCost + outputCost;
    const totalTokens = inputTokens + outputTokens;

    return {
      totalTokens,
      inputCost: Math.round(inputCost * 10000) / 10000, // Round to 4 decimal places
      outputCost: Math.round(outputCost * 10000) / 10000,
      totalCost: Math.round(totalCost * 10000) / 10000,
      currency: 'USD',
    };
  }, [input.inputTokens, input.outputTokens, input.provider, input.model]);
}

/**
 * Utility function to calculate cost without React hook
 * Useful for server-side calculations or outside React components
 */
export function calculateTokenCost(input: TokenCostInput): TokenCostResult {
  const pricing = getPricing(input.provider, input.model);
  const inputCost = (input.inputTokens / 1_000_000) * pricing.input;
  const outputCost = (input.outputTokens / 1_000_000) * pricing.output;
  const totalCost = inputCost + outputCost;
  const totalTokens = input.inputTokens + input.outputTokens;

  return {
    totalTokens,
    inputCost: Math.round(inputCost * 10000) / 10000,
    outputCost: Math.round(outputCost * 10000) / 10000,
    totalCost: Math.round(totalCost * 10000) / 10000,
    currency: 'USD',
  };
}
