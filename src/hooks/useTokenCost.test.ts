/**
 * useTokenCost Hook Tests
 * 测试 Token 成本计算功能
 */

import { describe, it, expect } from 'vitest';
import { calculateTokenCost, useTokenCost } from '@/hooks/useTokenCost';
import { renderHook } from '@testing-library/react';

describe('calculateTokenCost', () => {
  describe('Claude pricing', () => {
    it('should calculate cost for Claude Sonnet 4', () => {
      const cost = calculateTokenCost({ inputTokens: 1000, outputTokens: 2000, provider: 'claude' });
      expect(cost.inputCost).toBeCloseTo(0.003, 4); // $3/M
      expect(cost.outputCost).toBeCloseTo(0.03, 4); // $15/M
      expect(cost.totalCost).toBeCloseTo(0.033, 4);
    });

    it('should calculate cost for large token counts', () => {
      const cost = calculateTokenCost({ inputTokens: 50000, outputTokens: 10000, provider: 'claude' });
      expect(cost.inputCost).toBeCloseTo(0.15, 2); // 50K * $3/M
      expect(cost.outputCost).toBeCloseTo(0.15, 2); // 10K * $15/M
      expect(cost.totalCost).toBeCloseTo(0.30, 2);
    });

    it('should handle zero tokens', () => {
      const cost = calculateTokenCost({ inputTokens: 0, outputTokens: 0, provider: 'claude' });
      expect(cost.inputCost).toBe(0);
      expect(cost.outputCost).toBe(0);
      expect(cost.totalCost).toBe(0);
    });
  });

  describe('OpenAI pricing', () => {
    it('should calculate cost for GPT-4o', () => {
      const cost = calculateTokenCost({ inputTokens: 1000, outputTokens: 2000, provider: 'openai' });
      expect(cost.inputCost).toBeCloseTo(0.0025, 4); // $2.50/M
      expect(cost.outputCost).toBeCloseTo(0.02, 4); // $10/M
      expect(cost.totalCost).toBeCloseTo(0.0225, 4);
    });

    it('should calculate cost for large requests', () => {
      const cost = calculateTokenCost({ inputTokens: 100000, outputTokens: 50000, provider: 'openai' });
      expect(cost.inputCost).toBeCloseTo(0.25, 2); // 100K * $2.50/M
      expect(cost.outputCost).toBeCloseTo(0.50, 2); // 50K * $10/M
      expect(cost.totalCost).toBeCloseTo(0.75, 2);
    });
  });

  describe('Gemini pricing', () => {
    it('should calculate cost for Gemini 2.0 Flash', () => {
      const cost = calculateTokenCost({ inputTokens: 1000, outputTokens: 2000, provider: 'gemini' });
      expect(cost.inputCost).toBeCloseTo(0.0005, 4); // $0.50/M
      expect(cost.outputCost).toBeCloseTo(0.003, 4); // $1.50/M
      expect(cost.totalCost).toBeCloseTo(0.0035, 4);
    });

    it('should be much cheaper than Claude or OpenAI', () => {
      const claudeCost = calculateTokenCost({ inputTokens: 1000, outputTokens: 2000, provider: 'claude' });
      const geminiCost = calculateTokenCost({ inputTokens: 1000, outputTokens: 2000, provider: 'gemini' });

      expect(geminiCost.totalCost).toBeLessThan(claudeCost.totalCost);
      expect(geminiCost.totalCost / claudeCost.totalCost).toBeCloseTo(0.106, 2); // ~9.4x cheaper
    });
  });

  describe('Local AI (Ollama) pricing', () => {
    it('should always return zero cost for local AI', () => {
      const cost = calculateTokenCost({ inputTokens: 1000000, outputTokens: 1000000, provider: 'local' });
      expect(cost.inputCost).toBe(0);
      expect(cost.outputCost).toBe(0);
      expect(cost.totalCost).toBe(0);
    });

    it('should be free regardless of token count', () => {
      const smallCost = calculateTokenCost({ inputTokens: 1, outputTokens: 1, provider: 'local' });
      const largeCost = calculateTokenCost({ inputTokens: 999999, outputTokens: 999999, provider: 'local' });

      expect(smallCost.totalCost).toBe(0);
      expect(largeCost.totalCost).toBe(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle negative tokens (returns zero)', () => {
      const cost = calculateTokenCost({ inputTokens: -100, outputTokens: -200, provider: 'claude' });
      expect(cost.inputCost).toBeLessThan(0);
      expect(cost.outputCost).toBeLessThan(0);
      expect(cost.totalCost).toBeLessThan(0);
    });

    it('should handle decimal token counts', () => {
      const cost = calculateTokenCost({ inputTokens: 1000.5, outputTokens: 2000.7, provider: 'claude' });
      expect(cost.inputCost).toBeGreaterThan(0);
      expect(cost.outputCost).toBeGreaterThan(0);
    });

    it('should handle unknown provider (defaults to fallback pricing)', () => {
      const cost = calculateTokenCost({ inputTokens: 1000, outputTokens: 2000, provider: 'unknown' as any });
      expect(cost.inputCost).toBeCloseTo(0.001, 4); // $1/M fallback
      expect(cost.outputCost).toBeCloseTo(0.004, 4); // $2/M fallback
    });
  });

  describe('Cost comparison', () => {
    it('should rank providers by cost for same token usage', () => {
      const claudeCost = calculateTokenCost({ inputTokens: 10000, outputTokens: 5000, provider: 'claude' });
      const openaiCost = calculateTokenCost({ inputTokens: 10000, outputTokens: 5000, provider: 'openai' });
      const geminiCost = calculateTokenCost({ inputTokens: 10000, outputTokens: 5000, provider: 'gemini' });
      const localCost = calculateTokenCost({ inputTokens: 10000, outputTokens: 5000, provider: 'local' });

      expect(localCost.totalCost).toBe(0);
      expect(geminiCost.totalCost).toBeLessThan(claudeCost.totalCost);
      expect(geminiCost.totalCost).toBeLessThan(openaiCost.totalCost);
    });

    it('should calculate percentage difference between providers', () => {
      const claudeCost = calculateTokenCost({ inputTokens: 10000, outputTokens: 5000, provider: 'claude' });
      const geminiCost = calculateTokenCost({ inputTokens: 10000, outputTokens: 5000, provider: 'gemini' });

      const savings = ((claudeCost.totalCost - geminiCost.totalCost) / claudeCost.totalCost) * 100;

      expect(savings).toBeCloseTo(88.1, 1); // ~88% cheaper
    });
  });
});

describe('useTokenCost Hook', () => {
  it('should provide memoized cost calculations', () => {
    const { result } = renderHook(() =>
      useTokenCost({ inputTokens: 1000, outputTokens: 2000, provider: 'claude' })
    );

    expect(result.current.totalCost).toBeCloseTo(0.033, 4);
    expect(result.current.inputCost).toBeCloseTo(0.003, 4);
    expect(result.current.outputCost).toBeCloseTo(0.03, 4);
  });

  it('should update when dependencies change', () => {
    const { result, rerender } = renderHook(
      ({ inputTokens, outputTokens, provider }) =>
        useTokenCost({ inputTokens, outputTokens, provider }),
      {
        initialProps: {
          inputTokens: 1000,
          outputTokens: 2000,
          provider: 'claude' as const,
        },
      }
    );

    expect(result.current.totalCost).toBeCloseTo(0.033, 4);

    rerender({ inputTokens: 2000, outputTokens: 4000, provider: 'claude' });

    expect(result.current.totalCost).toBeCloseTo(0.066, 4);
  });

  it('should handle provider changes', () => {
    const { result, rerender } = renderHook(
      ({ inputTokens, outputTokens, provider }) =>
        useTokenCost({ inputTokens, outputTokens, provider }),
      {
        initialProps: {
          inputTokens: 1000,
          outputTokens: 2000,
          provider: 'claude' as const,
        },
      }
    );

    const claudeCost = result.current.totalCost;

    rerender({ inputTokens: 1000, outputTokens: 2000, provider: 'gemini' });

    const geminiCost = result.current.totalCost;

    expect(geminiCost).toBeLessThan(claudeCost);
  });

  it('should handle zero tokens gracefully', () => {
    const { result } = renderHook(() =>
      useTokenCost({ inputTokens: 0, outputTokens: 0, provider: 'claude' })
    );

    expect(result.current.totalCost).toBe(0);
  });
});
