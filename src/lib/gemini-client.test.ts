/**
 * Gemini Client Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { streamGeminiResponse, getGeminiResponse, calculateGeminiCost } from './gemini-client';
import type { Message, ProviderConfig } from './types';

// Mock fetch globally
global.fetch = vi.fn();

describe('Gemini Client', () => {
  const mockProvider: ProviderConfig = {
    apiKey: 'test-key',
    baseUrl: 'https://generativelanguage.googleapis.com',
    model: 'gemini-2.5-flash',
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

  describe('calculateGeminiCost', () => {
    it('should calculate cost correctly', () => {
      const cost = calculateGeminiCost(1000, 1000);
      expect(cost).toBe(0.002); // (1000/1000000 * 0.50) + (1000/1000000 * 1.50)
    });

    it('should handle zero tokens', () => {
      const cost = calculateGeminiCost(0, 0);
      expect(cost).toBe(0);
    });
  });

  describe('getGeminiResponse', () => {
    it('should throw error when API key is missing', async () => {
      const noKeyProvider = { ...mockProvider, apiKey: '' };

      await expect(
        getGeminiResponse(mockMessages, noKeyProvider)
      ).rejects.toThrow('Gemini API Key is required');
    });
  });

  describe('streamGeminiResponse', () => {
    it('should throw error when API key is missing', async () => {
      const noKeyProvider = { ...mockProvider, apiKey: '' };

      await expect(
        streamGeminiResponse({
          messages: mockMessages,
          provider: noKeyProvider,
        })
      ).rejects.toThrow('Gemini API Key is required');
    });
  });
});
