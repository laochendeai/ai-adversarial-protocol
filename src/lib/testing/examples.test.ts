/**
 * Example Tests Using Test Utilities
 * 使用测试工具的示例测试
 *
 * This file demonstrates how to use the test utilities to write cleaner,
 * more maintainable tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createMockRequest,
  createMockMessage,
  createMockMessages,
  createMockVote,
  createMockConfig,
  resetAllMocks,
  wait,
  expectObjectProperties,
  TestDataFactories,
} from '@/lib/testing';

// Example 1: Testing with mock messages
describe('Message Processing', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('should create mock messages with correct structure', () => {
    const message = createMockMessage({
      id: 'custom-id',
      content: 'Custom content',
    });

    expect(message.id).toBe('custom-id');
    expect(message.content).toBe('Custom content');
    expect(message.role).toBe('assistant');
  });

  it('should create multiple messages efficiently', () => {
    const messages = createMockMessages(10, 'user');

    expect(messages).toHaveLength(10);
    messages.forEach(msg => {
      expect(msg.role).toBe('user');
    });
  });
});

// Example 2: Testing vote objects
describe('Vote Creation', () => {
  it('should create mock votes with all required properties', () => {
    const vote = createMockVote({
      voterId: 'openai',
      choice: 'msg-2',
    });

    expect(vote.voterId).toBe('openai');
    expect(vote.choice).toBe('msg-2');
    expectObjectProperties(vote, ['id', 'topicId', 'confidence', 'timestamp']);
  });
});

// Example 3: Using factory functions
describe('Data Factories', () => {
  it('should create voting requests with factory', () => {
    const request = TestDataFactories.votingRequest({
      providers: ['claude', 'openai', 'gemini'],
    });

    expect(request.messages).toHaveLength(2);
    expect(request.providers).toHaveLength(3);
  });

  it('should create challenges with factory', () => {
    const challenge = TestDataFactories.challenge({
      severity: 'low',
    });

    expect(challenge.severity).toBe('low');
  });
});

// Example 4: Testing async operations
describe('Async Operations', () => {
  it('should wait for specified duration', async () => {
    const start = Date.now();
    await wait(100);
    const duration = Date.now() - start;

    expect(duration).toBeGreaterThanOrEqual(100);
    expect(duration).toBeLessThan(150); // Account for timing variance
  });
});

// Example 5: Testing config helpers
describe('Config Helpers', () => {
  it('should create mock config with all providers', () => {
    const config = createMockConfig();

    expect(config.claude).toBeDefined();
    expect(config.openai).toBeDefined();
    expect(config.gemini).toBeDefined();
    expect(config.local).toBeDefined();
  });
});

// Example 6: Mock request creation
describe('Request Helpers', () => {
  it('should create mock requests with JSON body', async () => {
    const body = { test: 'data' };
    const request = createMockRequest(body);

    expect(request.json).toBeDefined();
    const json = await request.json();
    expect(json).toEqual(body);
  });
});
