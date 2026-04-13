/**
 * API Helpers Tests
 * API 辅助函数测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { callClaudeAPI, callOpenAIAPI, callGeminiAPI, callOllamaAPI } from './api-helpers';
import * as claudeClient from './claude-client';
import * as openaiClient from './openai-client';
import * as geminiClient from './gemini-client';
import * as ollamaClient from './ollama-client';
import type { Message } from './types';

// Mock the client modules
vi.mock('./claude-client');
vi.mock('./openai-client');
vi.mock('./gemini-client');
vi.mock('./ollama-client');

describe('API Helpers', () => {
  const mockDebateState = {
    messages: [] as Message[],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('callClaudeAPI', () => {
    it('should call streamClaudeResponse with correct parameters', async () => {
      const mockContent = 'Test response';
      vi.mocked(claudeClient.streamClaudeResponse).mockResolvedValue({
        content: mockContent,
        messageId: 'msg-123',
        usage: { inputTokens: 10, outputTokens: 20 },
      });

      const result = await callClaudeAPI({
        question: 'Hello',
        debateState: mockDebateState,
        apiKey: 'test-key',
        baseUrl: 'https://api.anthropic.com',
        model: 'claude-sonnet-4-20250514',
      });

      expect(claudeClient.streamClaudeResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: 'Hello',
            }),
          ]),
        })
      );
      expect(result.content).toBe(mockContent);
      expect(result.messageId).toBeDefined();
    });

    it('should handle opponent message in context', async () => {
      vi.mocked(claudeClient.streamClaudeResponse).mockResolvedValue({
        content: 'Response with context',
        messageId: 'msg-456',
        usage: { inputTokens: 15, outputTokens: 25 },
      });

      const opponentMessage: Message = {
        id: 'opp-1',
        role: 'assistant',
        provider: 'openai',
        content: 'Previous answer',
        timestamp: Date.now(),
      };

      const result = await callClaudeAPI({
        question: 'Hello',
        debateState: mockDebateState,
        opponentMessage,
        apiKey: 'test-key',
        baseUrl: 'https://api.anthropic.com',
        model: 'claude-sonnet-4-20250514',
      });

      expect(claudeClient.streamClaudeResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          opponentMessage,
        })
      );
      expect(result.content).toBe('Response with context');
    });

    it('should handle errors from streamClaudeResponse', async () => {
      vi.mocked(claudeClient.streamClaudeResponse).mockRejectedValue(
        new Error('Claude API error: 400 Bad Request')
      );

      await expect(
        callClaudeAPI({
          question: 'Hello',
          debateState: mockDebateState,
          apiKey: 'test-key',
          baseUrl: 'https://api.anthropic.com',
          model: 'claude-sonnet-4-20250514',
        })
      ).rejects.toThrow('Claude API error: 400 Bad Request');
    });

    it('should handle network errors', async () => {
      vi.mocked(claudeClient.streamClaudeResponse).mockRejectedValue(
        new Error('Claude API request failed: Network error')
      );

      await expect(
        callClaudeAPI({
          question: 'Hello',
          debateState: mockDebateState,
          apiKey: 'test-key',
          baseUrl: 'https://api.anthropic.com',
          model: 'claude-sonnet-4-20250514',
        })
      ).rejects.toThrow('Claude API request failed: Network error');
    });
  });

  describe('callOpenAIAPI', () => {
    it('should call streamOpenAIResponse with correct parameters', async () => {
      const mockContent = 'Test OpenAI response';
      vi.mocked(openaiClient.streamOpenAIResponse).mockResolvedValue({
        content: mockContent,
        messageId: 'msg-789',
        usage: { inputTokens: 15, outputTokens: 25 },
      });

      const result = await callOpenAIAPI({
        question: 'Hello OpenAI',
        debateState: mockDebateState,
        apiKey: 'test-key',
        baseUrl: 'https://api.openai.com',
        model: 'gpt-4o',
      });

      expect(openaiClient.streamOpenAIResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: 'Hello OpenAI',
            }),
          ]),
        })
      );
      expect(result.content).toBe(mockContent);
      expect(result.messageId).toBeDefined();
    });

    it('should handle errors from streamOpenAIResponse', async () => {
      vi.mocked(openaiClient.streamOpenAIResponse).mockRejectedValue(
        new Error('OpenAI API error: 500 Internal Server Error')
      );

      await expect(
        callOpenAIAPI({
          question: 'Hello',
          debateState: mockDebateState,
          apiKey: 'test-key',
          baseUrl: 'https://api.openai.com',
          model: 'gpt-4o',
        })
      ).rejects.toThrow('OpenAI API error: 500 Internal Server Error');
    });
  });

  describe('callGeminiAPI', () => {
    it('should call streamGeminiResponse with correct parameters', async () => {
      const mockContent = 'Test Gemini response';
      vi.mocked(geminiClient.streamGeminiResponse).mockResolvedValue({
        content: mockContent,
        messageId: 'msg-101',
        usage: { inputTokens: 20, outputTokens: 30 },
      });

      const result = await callGeminiAPI({
        question: 'Hello Gemini',
        debateState: mockDebateState,
        apiKey: 'test-key',
        baseUrl: 'https://generativelanguage.googleapis.com',
        model: 'gemini-2.5-flash',
      });

      expect(geminiClient.streamGeminiResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: 'Hello Gemini',
            }),
          ]),
        })
      );
      expect(result.content).toBe(mockContent);
      expect(result.messageId).toBeDefined();
    });

    it('should handle errors from streamGeminiResponse', async () => {
      vi.mocked(geminiClient.streamGeminiResponse).mockRejectedValue(
        new Error('Gemini API error: 403 Forbidden')
      );

      await expect(
        callGeminiAPI({
          question: 'Hello',
          debateState: mockDebateState,
          apiKey: 'test-key',
          baseUrl: 'https://generativelanguage.googleapis.com',
          model: 'gemini-2.5-flash',
        })
      ).rejects.toThrow('Gemini API error: 403 Forbidden');
    });
  });

  describe('callOllamaAPI', () => {
    it('should call streamOllamaResponse with correct parameters', async () => {
      const mockContent = 'Test Ollama response';
      vi.mocked(ollamaClient.streamOllamaResponse).mockResolvedValue({
        content: mockContent,
        messageId: 'msg-112',
        usage: { inputTokens: 5, outputTokens: 10 },
      });

      const result = await callOllamaAPI({
        question: 'Hello Ollama',
        debateState: mockDebateState,
        baseUrl: 'http://localhost:11434',
        model: 'llama3.2',
      });

      expect(ollamaClient.streamOllamaResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: 'Hello Ollama',
            }),
          ]),
        })
      );
      expect(result.content).toBe(mockContent);
      expect(result.messageId).toBeDefined();
    });

    it('should handle errors from streamOllamaResponse', async () => {
      vi.mocked(ollamaClient.streamOllamaResponse).mockRejectedValue(
        new Error('Ollama API error: 404 Not Found')
      );

      await expect(
        callOllamaAPI({
          question: 'Hello',
          debateState: mockDebateState,
          baseUrl: 'http://localhost:11434',
          model: 'llama3.2',
        })
      ).rejects.toThrow('Ollama API error: 404 Not Found');
    });

    it('should handle connection errors', async () => {
      vi.mocked(ollamaClient.streamOllamaResponse).mockRejectedValue(
        new Error('Ollama API request failed: ECONNREFUSED')
      );

      await expect(
        callOllamaAPI({
          question: 'Hello',
          debateState: mockDebateState,
          baseUrl: 'http://localhost:11434',
          model: 'llama3.2',
        })
      ).rejects.toThrow('Ollama API request failed: ECONNREFUSED');
    });
  });
});
