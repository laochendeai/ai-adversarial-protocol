/**
 * API Route Test Utilities
 * API 路由测试专用工具
 *
 * Specialized helpers for testing API routes with consistent patterns
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createMockRequest, createMockConfig, resetAllMocks } from './test-helpers';
import { POST } from '@/app/api/voting/route';
import { POST as AutoChallengePOST } from '@/app/api/auto-challenge/route';

/**
 * Test suite builder for API routes
 */
export function describeApiRoute(
  name: string,
  testFn: () => void
) {
  describe(name, () => {
    beforeEach(() => {
      resetAllMocks();
    });

    testFn();
  });
}

/**
 * Creates a voting API test suite
 */
export function testVotingApi(description: string, testFn: () => void) {
  describeApiRoute(`Voting API: ${description}`, testFn);
}

/**
 * Creates an auto-challenge API test suite
 */
export function testAutoChallengeApi(description: string, testFn: () => void) {
  describeApiRoute(`Auto-Challenge API: ${description}`, testFn);
}

/**
 * Helper to test API error responses
 */
export async function testErrorResponse(
  apiCall: () => Promise<Response>,
  expectedStatus: number,
  expectedError?: string
) {
  const response = await apiCall();
  const data = await response.json();

  expect(response.status).toBe(expectedStatus);
  expect(data.success).toBe(false);

  if (expectedError) {
    expect(data.error).toContain(expectedError);
  }

  return data;
}

/**
 * Helper to test API success responses
 */
export async function testSuccessResponse(
  apiCall: () => Promise<Response>,
  expectedData?: any
) {
  const response = await apiCall();
  const data = await response.json();

  expect(response.status).toBe(200);
  expect(data.success).toBe(true);

  if (expectedData) {
    expect(data.data).toMatchObject(expectedData);
  }

  return data;
}

/**
 * Creates a standard set of API validation tests
 */
export function createApiValidationTests(
  endpointName: string,
  validRequest: () => any,
  requiredFields: string[] = []
) {
  describeApiRoute(`${endpointName} - Validation`, () => {
    it('should accept a valid request', async () => {
      const request = createMockRequest(validRequest());
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBeLessThan(400);
      expect(data.success).toBeDefined();
    });

    requiredFields.forEach(field => {
      it(`should reject request missing ${field}`, async () => {
        const request = validRequest();
        delete request[field];

        const response = await POST(createMockRequest(request));
        const data = await response.json();

        expect(response.status).toBeGreaterThanOrEqual(400);
      });
    });

    it('should handle malformed JSON', async () => {
      const request = {
        json: async () => {
          throw new Error('Invalid JSON');
        },
      } as unknown as any;

      const response = await POST(request);
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });
}

/**
 * Performance test helper for API endpoints
 */
export async function testApiResponseTime(
  apiCall: () => Promise<Response>,
  maxDurationMs: number
) {
  const start = Date.now();
  const response = await apiCall();
  const duration = Date.now() - start;

  expect(duration).toBeLessThan(maxDurationMs);
  return { response, duration };
}

/**
 * Creates mock provider configurations for testing
 */
export function createMockProviders(providers: string[]) {
  return providers.map(provider => ({
    id: provider,
    name: provider.charAt(0).toUpperCase() + provider.slice(1),
    enabled: true,
    type: provider === 'local' ? 'ollama' : provider === 'claude' ? 'anthropic' : provider === 'openai' ? 'openai' : 'google',
    weight: provider === 'local' ? 0.5 : 1.0,
  }));
}

/**
 * Test data factories for complex objects
 */
export const TestDataFactories = {
  votingRequest: (overrides?: any) => ({
    messages: [
      { id: 'msg-1', role: 'assistant', content: 'Response 1' },
      { id: 'msg-2', role: 'assistant', content: 'Response 2' },
    ],
    topic: { id: 'topic-1', content: 'Test topic' },
    providers: ['claude', 'openai'],
    config: { mode: 'majority' as const, threshold: 0.7 },
    context: {},
    ...overrides,
  }),

  autoChallengeRequest: (overrides?: any) => ({
    messageA: { id: 'msg-1', role: 'assistant', content: 'Claude response', timestamp: Date.now() },
    messageB: { id: 'msg-2', role: 'assistant', content: 'OpenAI response', timestamp: Date.now() },
    config: {
      enabled: true,
      confidenceThreshold: 0.7,
      maxChallenges: 5,
    },
    ...overrides,
  }),

  challenge: (overrides?: any) => ({
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
  }),
};

/**
 * Helper to run a test with multiple providers
 */
export async function testWithMultipleProviders(
  testFn: (providers: string[]) => Promise<void>,
  providers: string[][] = [['claude'], ['openai'], ['gemini'], ['local'], ['claude', 'openai']]
) {
  for (const providerSet of providers) {
    await testFn(providerSet);
  }
}

/**
 * Creates a spy for tracking API calls
 */
export function createApiCallSpy() {
  const calls: any[] = [];

  return {
    track: (provider: string, details: any) => {
      calls.push({ provider, ...details, timestamp: Date.now() });
    },
    getCalls: () => calls,
    getCallCount: () => calls.length,
    getCallsByProvider: (provider: string) => calls.filter(c => c.provider === provider),
    reset: () => {
      calls.length = 0;
    },
  };
}
