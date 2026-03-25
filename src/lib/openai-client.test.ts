/**
 * OpenAI Client Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { streamOpenAIResponse, getOpenAIResponse, calculateOpenAICost } from './openai-client';
import type { Message, ProviderConfig } from './types';

// Mock fetch globally
global.fetch = vi.fn();

describe('OpenAI Client', () => {
  const mockProvider: ProviderConfig = {
    apiKey: 'test-key',
    baseUrl: 'https://api.openai.com',
    model: 'gpt-4o',
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

  describe('calculateOpenAICost', () => {
    it('should calculate cost correctly for GPT-4o', () => {
      const cost = calculateOpenAICost(1000, 1000);
      expect(cost).toBe(0.0125); // (1000/1000 * 0.0025) + (1000/1000 * 0.01)
    });

    it('should handle zero tokens', () => {
      const cost = calculateOpenAICost(0, 0);
      expect(cost).toBe(0);
    });
  });

  describe('getOpenAIResponse', () => {
    it('should call OpenAI API with correct parameters', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Test response' } }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await getOpenAIResponse(mockMessages, mockProvider);

      const fetchCall = (global.fetch as any).mock.calls[0];
      expect(fetchCall[0]).toBe('https://api.openai.com/v1/chat/completions');
      expect(fetchCall[1].method).toBe('POST');
      // Headers can be either 'Authorization' or 'authorization' depending on fetch normalization
      const authHeader = fetchCall[1].headers['Authorization'] || fetchCall[1].headers['authorization'];
      expect(authHeader).toBe('Bearer test-key');
      expect(result.content).toBe('Test response');
    });

    it('should throw error when API key is missing', async () => {
      const noKeyProvider = { ...mockProvider, apiKey: '' };

      await expect(
        getOpenAIResponse(mockMessages, noKeyProvider)
      ).rejects.toThrow('OpenAI API Key is required');
    });
  });

  describe('streamOpenAIResponse', () => {
    it('should throw error when API key is missing', async () => {
      const noKeyProvider = { ...mockProvider, apiKey: '' };

      await expect(
        streamOpenAIResponse({
          messages: mockMessages,
          provider: noKeyProvider,
        })
      ).rejects.toThrow('OpenAI API Key is required');
    });
  });
});
