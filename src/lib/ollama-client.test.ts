/**
 * Ollama Client Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { streamOllamaResponse, calculateOllamaCost } from './ollama-client';
import type { Message, ProviderConfig } from './types';

// Mock fetch globally
global.fetch = vi.fn();

describe('Ollama Client', () => {
  const mockProvider: ProviderConfig = {
    apiKey: '',
    baseUrl: 'http://localhost:11434',
    model: 'llama3.2',
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

  describe('calculateOllamaCost', () => {
    it('should return zero cost for local model', () => {
      const cost = calculateOllamaCost(1000, 1000);
      expect(cost).toBe(0); // Local models are free
    });
  });

  describe('streamOllamaResponse', () => {
    it('should handle network errors', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('ECONNREFUSED'));

      await expect(
        streamOllamaResponse({
          messages: mockMessages,
          provider: mockProvider,
        })
      ).rejects.toThrow('ECONNREFUSED');
    });

    it('should handle no response body', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        body: null,
      });

      await expect(
        streamOllamaResponse({
          messages: mockMessages,
          provider: mockProvider,
        })
      ).rejects.toThrow('No response body');
    });
  });
});
