/**
 * Claude Client Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { streamClaudeResponse, getClaudeResponse, calculateClaudeCost } from './claude-client';
import type { Message, ProviderConfig } from './types';

// Mock fetch globally
global.fetch = vi.fn();

describe('Claude Client', () => {
  const mockProvider: ProviderConfig = {
    apiKey: 'test-key',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-20250514',
  };

  const mockMessages: Message[] = [
    {
      id: 'msg-1',
      role: 'user',
      content: 'Hello',
      timestamp: Date.now(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateClaudeCost', () => {
    it('should calculate cost correctly for Claude Sonnet 4', () => {
      const cost = calculateClaudeCost(1000, 1000);
      expect(cost).toBe(0.018); // (1000/1000 * 0.003) + (1000/1000 * 0.015)
    });

    it('should handle zero tokens', () => {
      const cost = calculateClaudeCost(0, 0);
      expect(cost).toBe(0);
    });

    it('should handle large token counts', () => {
      const cost = calculateClaudeCost(100000, 50000);
      expect(cost).toBe(1.05); // (100 * 0.003) + (50 * 0.015) = 0.3 + 0.75
    });
  });

  describe('getClaudeResponse', () => {
    it('should call Claude API with correct parameters', async () => {
      const mockResponse = {
        content: [{ text: 'Test response' }],
        usage: {
          input_tokens: 10,
          output_tokens: 20,
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await getClaudeResponse(mockMessages, mockProvider);

      const fetchCall = (global.fetch as any).mock.calls[0];
      expect(fetchCall[0]).toBe('https://api.anthropic.com/v1/messages');
      expect(fetchCall[1].method).toBe('POST');
      expect(fetchCall[1].headers['x-api-key']).toBe('test-key');
      expect(fetchCall[1].headers['anthropic-version']).toBe('2023-06-01');
      expect(result.content).toBe('Test response');
      expect(result.inputTokens).toBe(10);
      expect(result.outputTokens).toBe(20);
    });

    it('should handle API errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'Invalid request',
      });

      await expect(
        getClaudeResponse(mockMessages, mockProvider)
      ).rejects.toThrow('Claude API error: 400 Bad Request');
    });

    it('should throw error when API key is missing', async () => {
      const noKeyProvider = { ...mockProvider, apiKey: '' };

      await expect(
        getClaudeResponse(mockMessages, noKeyProvider)
      ).rejects.toThrow('Claude API Key is required');
    });
  });

  describe('streamClaudeResponse', () => {
    it('should throw error when API key is missing', async () => {
      const noKeyProvider = { ...mockProvider, apiKey: '' };

      await expect(
        streamClaudeResponse({
          messages: mockMessages,
          provider: noKeyProvider,
        })
      ).rejects.toThrow('Claude API Key is required');
    });

    it('should handle network errors', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      await expect(
        streamClaudeResponse({
          messages: mockMessages,
          provider: mockProvider,
        })
      ).rejects.toThrow('Network error');
    });

    it('should call onError callback when error occurs', async () => {
      const onError = vi.fn();
      (global.fetch as any).mockRejectedValueOnce(new Error('API error'));

      try {
        await streamClaudeResponse({
          messages: mockMessages,
          provider: mockProvider,
          onError,
        });
      } catch (e) {
        // Expected to throw
      }

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should include opponent message in system prompt', async () => {
      // Create a mock reader that simulates SSE stream
      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"type":"message_start","message":{"usage":{"input_tokens":10}}}\n\n') })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"type":"content_block_delta","delta":{"text":"Hello"}}\n\n') })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: [DONE]\n\n') })
          .mockResolvedValueOnce({ done: true, value: undefined }),
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => mockReader,
        },
      });

      const opponentMessage: Message = {
        id: 'opp-1',
        role: 'assistant',
        provider: 'openai',
        content: 'Opponent says hi',
        timestamp: Date.now(),
      };

      const chunks: string[] = [];
      await streamClaudeResponse({
        messages: mockMessages,
        provider: mockProvider,
        opponentMessage,
        onChunk: (chunk) => chunks.push(chunk),
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          body: expect.stringContaining('另一个AI'),
        })
      );
    });
  });
});
