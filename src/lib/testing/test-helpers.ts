/**
 * Test Helpers and Utilities
 * 测试辅助工具和通用工具函数
 *
 * This file provides reusable test utilities to make writing tests faster
 * and more consistent across the codebase.
 */

import { NextRequest } from 'next/server';
import { Message, AIProvider, Vote, Challenge, AuditMetrics } from '@/lib/types';

/**
 * Creates a mock NextRequest with JSON body
 */
export function createMockRequest(body: any): NextRequest {
  return {
    json: async () => body,
  } as unknown as NextRequest;
}

/**
 * Creates a mock message for testing
 */
export function createMockMessage(overrides?: Partial<Message>): Message {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    role: 'assistant' as const,
    content: 'Test response content',
    timestamp: Date.now(),
    ...overrides,
  };
}

/**
 * Creates a mock user message
 */
export function createMockUserMessage(content: string = 'Test question'): Message {
  return {
    id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    role: 'user',
    content,
    timestamp: Date.now(),
  };
}

/**
 * Creates an array of mock messages
 */
export function createMockMessages(count: number, role: 'user' | 'assistant' = 'assistant'): Message[] {
  return Array.from({ length: count }, (_, i) => createMockMessage({
    id: `msg-${i}`,
    role,
  }));
}

/**
 * Creates a mock vote object
 */
export function createMockVote(overrides?: Partial<Vote>): Vote {
  return {
    id: `vote-${Date.now()}`,
    topicId: 'topic-1',
    voterId: 'claude',
    choice: 'msg-1',
    confidence: 0.9,
    reasoning: 'Test reasoning',
    timestamp: Date.now(),
    ...overrides,
  };
}

/**
 * Creates a mock challenge object
 */
export function createMockChallenge(overrides?: Partial<Challenge>): Challenge {
  return {
    id: `challenge-${Date.now()}`,
    targetId: 'msg-1',
    challengerAi: 'claude',
    challengeType: 'factual_error',
    severity: 'high',
    targetSegment: 'Problematic text',
    explanation: 'This is incorrect',
    confidence: 0.9,
    timestamp: Date.now(),
    ...overrides,
  };
}

/**
 * Creates mock audit metrics
 */
export function createMockMetrics(aiId: string = 'claude', overrides?: Partial<AuditMetrics>): AuditMetrics {
  return {
    aiId,
    totalMessages: 10,
    totalChallenges: 2,
    acceptedChallenges: 1,
    reliabilityScore: 85,
    challengesByType: {
      factualError: 1,
      logicalFlaw: 1,
      omission: 0,
      unclear: 0,
    },
    challengesBySeverity: {
      high: 1,
      medium: 1,
      low: 0,
    },
    ...overrides,
  };
}

/**
 * Mock API response helper
 */
export function createMockAIResponse(content: string, messageId?: string) {
  return {
    content,
    messageId: messageId || `msg-${Date.now()}`,
  };
}

/**
 * Creates a mock voting request body
 */
export function createMockVotingRequest(overrides?: any) {
  return {
    messages: [
      createMockMessage({ id: 'msg-1', content: 'Response 1' }),
      createMockMessage({ id: 'msg-2', content: 'Response 2' }),
    ],
    topic: { id: 'topic-1', content: 'Test topic' },
    providers: ['claude', 'openai'] as AIProvider[],
    config: {
      mode: 'majority' as const,
      threshold: 0.7,
    },
    context: {},
    ...overrides,
  };
}

/**
 * Creates a mock auto-challenge request body
 */
export function createMockAutoChallengeRequest(overrides?: any) {
  return {
    messageA: createMockMessage({ id: 'msg-1', content: 'Claude response' }),
    messageB: createMockMessage({ id: 'msg-2', content: 'OpenAI response' }),
    config: {
      enabled: true,
      confidenceThreshold: 0.7,
      maxChallenges: 5,
      challengeTypes: ['factual_error', 'logical_flaw', 'omission', 'unclear'],
    },
    ...overrides,
  };
}

/**
 * Wait for a specified duration (useful for testing async operations)
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Creates a mock config object for testing
 */
export function createMockConfig() {
  return {
    claude: {
      apiKey: 'test-claude-key',
      baseUrl: 'https://api.anthropic.com',
      model: 'claude-sonnet-4-20250514',
    },
    openai: {
      apiKey: 'test-openai-key',
      baseUrl: 'https://api.openai.com',
      model: 'gpt-4o',
    },
    gemini: {
      apiKey: 'test-gemini-key',
      baseUrl: 'https://generativelanguage.googleapis.com',
      model: 'gemini-2.0-flash',
    },
    local: {
      baseUrl: 'http://localhost:11434',
      model: 'llama3.2',
    },
  };
}

/**
 * Helper to create successful API response
 */
export function createSuccessResponse(data: any) {
  return Response.json({
    success: true,
    data,
  });
}

/**
 * Helper to create error API response
 */
export function createErrorResponse(error: string, status: number = 400) {
  return Response.json(
    {
      success: false,
      error,
    },
    { status }
  );
}

/**
 * Asserts that a response has the expected status and structure
 */
export async function expectApiResponse(
  response: Response,
  expectedSuccess: boolean = true,
  expectedStatus?: number
) {
  const data = await response.json();

  if (expectedStatus !== undefined) {
    expect(response.status).toBe(expectedStatus);
  }

  expect(data.success).toBe(expectedSuccess);

  if (expectedSuccess) {
    expect(data).toHaveProperty('data');
  } else {
    expect(data).toHaveProperty('error');
  }

  return data;
}

/**
 * Setup common mocks for API tests
 */
export function setupCommonMocks() {
  vi.mock('@/lib/config', () => ({
    getServerConfig: () => createMockConfig(),
  }));
}

/**
 * Resets all mocks between tests
 */
export function resetAllMocks() {
  vi.resetAllMocks();
}

/**
 * Helper to generate a random ID for tests
 */
export function generateTestId(prefix: string = 'test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Type assertion helper for Vitest
 */
export function expectType<T>(value: T): void {
  // This is a type assertion that will cause TypeScript errors if the type is wrong
  // At runtime, it does nothing
}

/**
 * Asserts that a promise rejects with an error containing specific text
 */
export async function expect_rejection(
  promise: Promise<any>,
  expectedErrorMessage?: string
): Promise<void> {
  await expect(promise).rejects.toThrow();

  if (expectedErrorMessage) {
    try {
      await promise;
    } catch (error: any) {
      expect(error.message).toContain(expectedErrorMessage);
    }
  }
}

/**
 * Creates a mock streaming response (for testing SSE)
 */
export function createMockStreamResponse(chunks: string[]): ReadableStream {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
        await wait(10); // Small delay between chunks
      }
      controller.close();
    },
  });
  return stream;
}

/**
 * Helper to test if an object has specific properties
 */
export function expectObjectProperties(obj: any, properties: string[]) {
  properties.forEach(prop => {
    expect(obj).toHaveProperty(prop);
  });
}

/**
 * Creates a test context with common setup
 */
export function createTestContext() {
  return {
    mockConfig: createMockConfig(),
    mockMessages: createMockMessages(2),
    resetMocks: resetAllMocks,
    setupMocks: setupCommonMocks,
  };
}
