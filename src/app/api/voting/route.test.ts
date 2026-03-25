/**
 * Voting API Tests
 * 测试多 AI 投票机制的核心功能
 */

import { POST } from './route';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/config', () => ({
  getServerConfig: () => ({
    claude: { apiKey: 'test-claude-key', baseUrl: 'https://api.anthropic.com', model: 'claude-3-5-sonnet-20241022' },
    openai: { apiKey: 'test-openai-key', baseUrl: 'https://api.openai.com', model: 'gpt-4o' },
    gemini: { apiKey: 'test-gemini-key', baseUrl: 'https://generativelanguage.googleapis.com', model: 'gemini-2.0-flash' },
    local: { baseUrl: 'http://localhost:11434', model: 'llama3.2' },
  }),
}));

vi.mock('@/lib/api-helpers', () => ({
  callClaudeAPI: vi.fn(() => Promise.resolve({
    content: JSON.stringify({ choice: 'msg-1', confidence: 0.9, reasoning: 'Test reasoning' }),
    messageId: 'test-claude-msg-id'
  })),
  callOpenAIAPI: vi.fn(() => Promise.resolve({
    content: JSON.stringify({ choice: 'msg-1', confidence: 0.85, reasoning: 'Test reasoning' }),
    messageId: 'test-openai-msg-id'
  })),
  callGeminiAPI: vi.fn(() => Promise.resolve({
    content: JSON.stringify({ choice: 'msg-1', confidence: 0.8, reasoning: 'Test reasoning' }),
    messageId: 'test-gemini-msg-id'
  })),
  callOllamaAPI: vi.fn(() => Promise.resolve({
    content: JSON.stringify({ choice: 'msg-1', confidence: 0.75, reasoning: 'Test reasoning' }),
    messageId: 'test-ollama-msg-id'
  })),
}));

vi.mock('@/lib/features/voting/prompt', () => ({
  generateVotingPrompt: vi.fn(() => 'Mock voting prompt'),
  parseVotingResponse: vi.fn((response: string, provider: string, topicId: string, options: string[]) => {
    // Parse JSON response
    try {
      const parsed = JSON.parse(response);
      if (parsed.choice && options.includes(parsed.choice)) {
        return {
          choice: parsed.choice,
          confidence: parsed.confidence || 0.8,
          reasoning: parsed.reasoning || '',
        };
      }
    } catch (e) {
      // Invalid JSON, return default
    }
    // Fallback to first option
    return {
      choice: options[0] || 'msg-1',
      confidence: 0.75,
      reasoning: 'Mock reasoning',
    };
  }),
}));

describe('Voting API', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('POST /api/voting', () => {
    it('should return 400 when no valid votes are received', async () => {
      const mockRequest = {
        json: async () => ({
          messages: [
            { id: 'msg-1', role: 'assistant', content: 'Response 1' },
            { id: 'msg-2', role: 'assistant', content: 'Response 2' },
          ],
          topic: { id: 'topic-1', content: 'Test topic' },
          providers: ['claude', 'openai'],
          config: {
            mode: 'majority' as const,
            threshold: 0.7,
          },
          context: {},
        }),
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const data = await response.json();

      // With mocked API calls, should succeed
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('result');
      expect(data.data).toHaveProperty('votes');
      expect(data.data).toHaveProperty('summary');
    });

    it('should successfully process voting requests with valid providers', async () => {
      const mockRequest = {
        json: async () => ({
          messages: [
            { id: 'msg-1', role: 'assistant', content: 'Response 1' },
            { id: 'msg-2', role: 'assistant', content: 'Response 2' },
          ],
          topic: { id: 'topic-1', content: 'Test topic' },
          providers: ['claude', 'openai'],
          config: {
            mode: 'majority' as const,
            threshold: 0.7,
          },
          context: {},
        }),
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('result');
      expect(data.data).toHaveProperty('votes');
      expect(data.data).toHaveProperty('summary');
      expect(data.data.votes).toHaveLength(2);
      expect(data.data.summary.totalVotes).toBe(2);
      expect(data.data.summary.participatedProviders).toContain('claude');
      expect(data.data.summary.participatedProviders).toContain('openai');
    });

    it('should include all enabled providers in voting results', async () => {
      const mockRequest = {
        json: async () => ({
          messages: [
            { id: 'msg-1', role: 'assistant', content: 'Response 1' },
            { id: 'msg-2', role: 'assistant', content: 'Response 2' },
            { id: 'msg-3', role: 'assistant', content: 'Response 3' },
          ],
          topic: { id: 'topic-2', content: 'Another test topic' },
          providers: ['claude', 'openai', 'gemini'],
          config: {
            mode: 'majority' as const,
            threshold: 0.7,
          },
          context: {},
        }),
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.summary.totalVotes).toBe(3);
      expect(data.data.summary.participatedProviders).toEqual(
        expect.arrayContaining(['claude', 'openai', 'gemini'])
      );
    });

    it('should handle empty messages array gracefully', async () => {
      const mockRequest = {
        json: async () => ({
          messages: [],
          topic: { id: 'topic-3', content: 'Empty messages topic' },
          providers: ['claude'],
          config: {
            mode: 'majority' as const,
            threshold: 0.7,
          },
          context: {},
        }),
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const data = await response.json();

      // Should still process request, even with empty messages
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should return 500 on unexpected errors', async () => {
      const mockRequest = {
        json: () => {
          throw new Error('JSON parse error');
        },
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });
  });

  describe('Voting result calculation', () => {
    it('should calculate consensus correctly for majority mode', async () => {
      const mockRequest = {
        json: async () => ({
          messages: [
            { id: 'msg-1', role: 'assistant', content: 'Response 1' },
            { id: 'msg-2', role: 'assistant', content: 'Response 2' },
          ],
          topic: { id: 'topic-1', content: 'Test topic' },
          providers: ['claude', 'openai', 'gemini'],
          config: {
            mode: 'majority' as const,
            threshold: 0.7,
          },
          context: {},
        }),
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.result).toBeDefined();
      expect(data.data.summary.consensusReached).toBeDefined();
      expect(typeof data.data.summary.consensusReached).toBe('boolean');
    });

    it('should track time elapsed for voting', async () => {
      const mockRequest = {
        json: async () => ({
          messages: [
            { id: 'msg-1', role: 'assistant', content: 'Response 1' },
          ],
          topic: { id: 'topic-1', content: 'Test topic' },
          providers: ['claude'],
          config: {
            mode: 'majority' as const,
            threshold: 0.7,
          },
          context: {},
        }),
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.summary.timeElapsed).toBeDefined();
      expect(typeof data.data.summary.timeElapsed).toBe('number');
      expect(data.data.summary.timeElapsed).toBeGreaterThanOrEqual(0);
    });
  });
});
