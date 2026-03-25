# Testing Guide

## 100% test coverage is the key to great vibe coding. Tests let you move fast, trust your instincts, and ship with confidence — without them, vibe coding is just yolo coding. With tests, it's a superpower.

## Framework

**Vitest** + **@testing-library/react** + **@testing-library/jest-dom** + **happy-dom**

## How to run tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests once
npm test -- --run

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

## Test Layers

### Unit Tests
- **What:** Test individual functions, hooks, and utilities in isolation
- **Where:** `src/lib/*.test.ts`, `src/hooks/*.test.ts`
- **When:** Every time you write a new function or modify existing logic
- **Examples:**
  - `src/hooks/useTokenCost.test.ts` - Token cost calculations
  - `src/lib/server-cache.test.ts` - Server-side caching
  - `src/lib/features/audit-metrics/__tests__/calculator.test.ts` - Audit metrics

### Integration Tests
- **What:** Test multiple modules working together
- **Where:** `src/app/api/**/*.test.ts`
- **When:** Testing API routes, data flows between components
- **Examples:**
  - `src/app/api/voting/route.test.ts` - Multi-AI voting endpoint
  - `src/app/api/auto-challenge/route.test.ts` - Auto-challenge endpoint

### Smoke Tests
- **What:** Verify critical paths work end-to-end
- **When:** After major changes, before deployment
- **Examples:**
  - API endpoints respond correctly
  - Critical functions produce expected output

### E2E Tests
- **What:** Full user flows in browser
- **Framework:** Playwright (to be added)
- **When:** Testing critical user workflows
- **Examples:**
  - Complete multi-AI debate flow
  - Settings panel configuration
  - Challenge creation workflow

## Test Utilities

The project includes reusable test utilities to make writing tests faster and more consistent.

### Import Test Utilities

```typescript
// Import all utilities
import {
  createMockRequest,
  createMockMessage,
  createMockVote,
  createMockChallenge,
  createMockVotingRequest,
  createMockConfig,
  // ... and more
} from '@/lib/testing';
```

### Available Utilities

#### Mock Request Creators
- `createMockRequest(body)` - Creates a mock NextRequest with JSON body
- `createMockMessages(count, role)` - Creates an array of mock messages
- `createMockMessage(overrides)` - Creates a single mock message with optional overrides

#### Mock Data Factories
- `createMockVote(overrides)` - Creates mock vote objects
- `createMockChallenge(overrides)` - Creates mock challenge objects
- `createMockMetrics(aiId, overrides)` - Creates mock audit metrics

#### API Request Helpers
- `createMockVotingRequest(overrides)` - Creates voting API request body
- `createMockAutoChallengeRequest(overrides)` - Creates auto-challenge API request body
- `createMockConfig()` - Creates mock API configuration

#### Assertion Helpers
- `expectApiResponse(response, expectedSuccess, expectedStatus)` - Asserts API response structure
- `testErrorResponse(apiCall, expectedStatus, expectedError)` - Tests error responses
- `testSuccessResponse(apiCall, expectedData)` - Tests success responses
- `expectObjectProperties(obj, properties)` - Asserts object has specific properties

#### Async Helpers
- `wait(ms)` - Wait for specified duration
- `expect_rejection(promise, expectedErrorMessage)` - Assert promise rejects

### Example Usage

#### Basic API Route Test
```typescript
import { describe, it, expect } from 'vitest';
import { createMockRequest, createMockVotingRequest } from '@/lib/testing';

describe('My API', () => {
  it('should handle voting requests', async () => {
    const request = createMockRequest(
      createMockVotingRequest({
        providers: ['claude', 'openai']
      })
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });
});
```

#### With Test Utilities
```typescript
import { describeApiRoute, testErrorResponse } from '@/lib/testing/api-test-helpers';

testVotingApi('Error Handling', () => {
  it('should return 400 when no valid votes received', async () => {
    await testErrorResponse(
      () => POST(createMockRequest({})),
      400,
      'No valid votes received'
    );
  });
});
```

#### Using Mock Data Factories
```typescript
import { createMockMessages, createMockMetrics } from '@/lib/testing';

describe('Message Processing', () => {
  it('should process multiple messages', () => {
    const messages = createMockMessages(5, 'user');
    expect(messages).toHaveLength(5);
  });

  it('should calculate metrics correctly', () => {
    const metrics = createMockMetrics('claude', {
      totalMessages: 20,
      totalChallenges: 3,
    });
    expect(metrics.totalMessages).toBe(20);
  });
});
```

## Conventions

### File Naming
- Test files are co-located with source files
- Pattern: `*.test.ts` (next to the file they test)
- Example: `useTokenCost.ts` → `useTokenCost.test.ts`

### Test Structure
```typescript
describe('FeatureName', () => {
  beforeEach(() => {
    // Setup before each test
  });

  describe('Scenario', () => {
    it('should do something specific', () => {
      // Arrange
      const input = ...;

      // Act
      const result = doSomething(input);

      // Assert
      expect(result).toBe(expected);
    });
  });
});
```

### Assertion Style
- Use `expect()` from Vitest
- Test what code DOES, not just that it doesn't throw
- Use `toBeCloseTo()` for floating point comparisons
- Use `toMatchSnapshot()` for component output (rarely needed)

### Setup/Teardown
- Use `beforeEach()` for test setup
- Use `afterEach()` for cleanup (via `@testing-library/react`'s `cleanup()`)
- Use `beforeAll()` for expensive one-time setup
- Mock external dependencies in `vitest.setup.ts`

## Test Expectations

### When writing new functions
- Write a corresponding test
- Test happy path + error paths + edge cases
- Never commit code without tests

### When fixing bugs
- Write a regression test that reproduces the bug
- Commit test + fix together
- Format: `test: regression test for {what broke}`

### When adding error handling
- Write a test that triggers the error
- Verify the error is handled gracefully
- Test user-visible error messages

### When adding conditionals (if/else, switch)
- Write tests for BOTH paths
- Ensure both branches work correctly

## Current Test Stats

**Last Updated:** 2026-03-25

- **Total Tests:** 86 (69 passing, 17 failing)
- **Test Files:** 6
- **Frameworks:** Vitest, React Testing Library, Happy DOM

### Test Files Created
1. `src/app/api/voting/route.test.ts` - 7 tests
2. `src/app/api/auto-challenge/route.test.ts` - 6 tests
3. `src/hooks/useTokenCost.test.ts` - 18 tests
4. `src/lib/server-cache.test.ts` - 18 tests
5. `src/lib/features/audit-metrics/__tests__/calculator.test.ts` - 19 tests
6. `src/lib/features/voting/__tests__/calculator.test.ts` - 18 tests

### Coverage Areas
- ✅ API Routes (voting, auto-challenge)
- ✅ Hooks (useTokenCost)
- ✅ Utilities (server-cache, voting calculator)
- ⏳ E2E Tests (coming soon)

## Next Steps

1. **Fix failing tests** - 17 tests need fixing
2. **Add component tests** - Test React components with @testing-library/react
3. **Add E2E tests** - Set up Playwright for browser tests
4. **Increase coverage** - Target 70%+ coverage

## Troubleshooting

### Tests not running?
- Check that dependencies are installed: `npm install`
- Verify vitest.config.ts exists
- Check test file naming: `*.test.ts`

### Mocks not working?
- Check `vitest.setup.ts` for mock configuration
- Verify `vi.mock()` calls are before imports
- Use `vi.mocked()` to access mocked functions

### Coverage not generating?
- Run: `npm run test:coverage`
- Check `coverage/` directory for HTML report
- Open `coverage/index.html` in browser

## Anti-Patterns

### ❌ Don't
- Test implementation details (private methods, internal state)
- Mock the code you're testing
- Write tests that just check something renders
- Skip tests for "obvious" code
- Commit failing tests

### ✅ Do
- Test behavior and outcomes
- Test error paths and edge cases
- Write descriptive test names
- Keep tests fast and focused
- Fix failing tests before committing

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
