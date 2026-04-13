/**
 * Auto-Challenge API Tests
 * 测试 AI 自动互相挑刺的核心功能
 */

import { POST } from './route';
import { NextRequest } from 'next/server';

// Mock fetch for API calls
global.fetch = vi.fn();

// Mock dependencies
vi.mock('@/lib/config', () => ({
  getServerConfig: () => ({
    claude: { apiKey: 'test-claude-key', baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-4-20250514' },
    openai: { apiKey: 'test-openai-key', baseUrl: 'https://api.openai.com', model: 'gpt-4o' },
  }),
}));

vi.mock('@/lib/features/auto-challenge/parser', () => ({
  parseChallengeResponse: vi.fn((response: string, ai: string, targetId: string) => {
    // Mock successful parsing
    return {
      challenges: [
        {
          id: `challenge-${Date.now()}`,
          targetId,
          challengerAi: ai,
          challengeType: 'factual_error',
          severity: 'high',
          targetSegment: 'Incorrect statement in the response',
          explanation: 'This is factually incorrect',
          confidence: 0.9,
          timestamp: Date.now(),
        },
      ],
      error: null,
    };
  }),
  deduplicateChallenges: vi.fn((challenges: any[]) => challenges),
  filterValidChallenges: vi.fn((challenges: any[]) => challenges),
  limitChallenges: vi.fn((challenges: any[], limit: number) => challenges.slice(0, limit)),
  calculateChallengeSummary: vi.fn((challenges: any[]) => ({
    total: challenges.length,
    byType: { factual_error: challenges.length },
    bySeverity: { high: challenges.length },
  })),
}));

describe('Auto-Challenge API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: JSON.stringify([{ challengeType: 'factual_error' }]) }],
        choices: [{ message: { content: JSON.stringify([{ challengeType: 'factual_error' }]) } }],
      }),
    } as Response);
  });

  describe('POST /api/auto-challenge', () => {
    it('should return error when auto-challenge is disabled', async () => {
      const mockRequest = {
        json: async () => ({
          messageA: {
            id: 'msg-1',
            role: 'assistant',
            content: 'Claude response',
            isClaude: true,
            timestamp: Date.now(),
          },
          messageB: {
            id: 'msg-2',
            role: 'assistant',
            content: 'OpenAI response',
            isClaude: false,
            timestamp: Date.now(),
          },
          config: {
            enabled: false,
            minConfidence: 0.7,
            maxChallengesPerRound: 5,
          },
        }),
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toBe('Auto-challenge is not enabled');
    });

    it('should successfully process auto-challenge when enabled', async () => {
      const mockRequest = {
        json: async () => ({
          messageA: {
            id: 'msg-1',
            role: 'assistant',
            content: 'Claude response here',
            isClaude: true,
            timestamp: Date.now(),
          },
          messageB: {
            id: 'msg-2',
            role: 'assistant',
            content: 'OpenAI response here',
            isClaude: false,
            timestamp: Date.now(),
          },
          config: {
            enabled: true,
            minConfidence: 0.7,
            maxChallengesPerRound: 5,
          },
        }),
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('challenges');
      expect(data.data).toHaveProperty('summary');
      expect(Array.isArray(data.data.challenges)).toBe(true);
      expect(data.data.summary).toHaveProperty('total');
      expect(data.data.summary).toHaveProperty('byType');
      expect(data.data.summary).toHaveProperty('bySeverity');
    });

    it('should handle API failures gracefully', async () => {
      // Mock fetch to fail
      vi.mocked(global.fetch).mockRejectedValue(new Error('API Error'));

      const mockRequest = {
        json: async () => ({
          messageA: {
            id: 'msg-1',
            role: 'assistant',
            content: 'Claude response',
            isClaude: true,
            timestamp: Date.now(),
          },
          messageB: {
            id: 'msg-2',
            role: 'assistant',
            content: 'OpenAI response',
            isClaude: false,
            timestamp: Date.now(),
          },
          config: {
            enabled: true,
            minConfidence: 0.7,
            maxChallengesPerRound: 5,
          },
        }),
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(data.success).toBe(true); // Still succeeds because one might work
      expect(data.data.errors).toBeDefined();
      expect(Array.isArray(data.data.errors)).toBe(true);
    });

    it('should return 500 on unexpected errors', async () => {
      const mockRequest = {
        json: () => {
          throw new Error('Unexpected error');
        },
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });
  });

  describe('Challenge processing', () => {
    it('should deduplicate challenges', async () => {
      const mockRequest = {
        json: async () => ({
          messageA: {
            id: 'msg-1',
            role: 'assistant',
            content: 'Claude response',
            isClaude: true,
            timestamp: Date.now(),
          },
          messageB: {
            id: 'msg-2',
            role: 'assistant',
            content: 'OpenAI response',
            isClaude: false,
            timestamp: Date.now(),
          },
          config: {
            enabled: true,
            minConfidence: 0.7,
            maxChallengesPerRound: 5,
          },
        }),
      } as unknown as NextRequest;

      const { deduplicateChallenges } = await import('@/lib/features/auto-challenge/parser');

      await POST(mockRequest);

      expect(deduplicateChallenges).toHaveBeenCalled();
    });

    it('should filter valid challenges', async () => {
      const mockRequest = {
        json: async () => ({
          messageA: {
            id: 'msg-1',
            role: 'assistant',
            content: 'Claude response',
            isClaude: true,
            timestamp: Date.now(),
          },
          messageB: {
            id: 'msg-2',
            role: 'assistant',
            content: 'OpenAI response',
            isClaude: false,
            timestamp: Date.now(),
          },
          config: {
            enabled: true,
            minConfidence: 0.7,
            maxChallengesPerRound: 5,
          },
        }),
      } as unknown as NextRequest;

      const { filterValidChallenges } = await import('@/lib/features/auto-challenge/parser');

      await POST(mockRequest);

      expect(filterValidChallenges).toHaveBeenCalled();
    });

    it('should limit challenges to maxChallengesPerRound', async () => {
      const mockRequest = {
        json: async () => ({
          messageA: {
            id: 'msg-1',
            role: 'assistant',
            content: 'Claude response',
            isClaude: true,
            timestamp: Date.now(),
          },
          messageB: {
            id: 'msg-2',
            role: 'assistant',
            content: 'OpenAI response',
            isClaude: false,
            timestamp: Date.now(),
          },
          config: {
            enabled: true,
            minConfidence: 0.7,
            maxChallengesPerRound: 3,
          },
        }),
      } as unknown as NextRequest;

      const { limitChallenges } = await import('@/lib/features/auto-challenge/parser');

      await POST(mockRequest);

      expect(limitChallenges).toHaveBeenCalledWith(expect.any(Array), 3);
    });
  });
});
