# Testing Guide

## Framework

**Vitest** for unit tests. No DOM testing utilities (no Web UI to test).

## Run

```bash
npm test                  # vitest --run
npm run test:watch        # vitest watch mode
npm run type-check        # tsc --noEmit
```

## Test Layers

### Unit
- **What:** Pure functions in `src/lib/features/**`, `src/config/`, `src/lib/clients/`.
- **Where:** Co-located `*.test.ts` next to the source.
- **Examples:**
  - `src/lib/features/audit-metrics/__tests__/calculator.test.ts` — score updates
  - `src/lib/features/voting/__tests__/calculator.test.ts` — majority/weighted/consensus algorithms

### Integration
- **What:** Engine + clients with mocked upstream HTTP.
- **Where:** `src/engine/__tests__/`.
- **What to assert:** event emission order, phase transitions, error path when one model fails.

### End-to-end (manual)
The repo doesn't run E2E in CI yet. Manual verification recipe:

1. Start headless server: `npx tsx src/cli.ts --no-tui --port 18788`
2. `curl -X POST http://127.0.0.1:18788/v1/chat/completions -H "Content-Type: application/json" -d '{"model":"adversarial:vote","messages":[{"role":"user","content":"hi"}]}'`
3. Verify response has `choices[0].message.content` + `x_adversarial.voting.winnerId`.
4. For streaming: add `"stream": true`, expect `data: {...}` chunks ending with `data: [DONE]`.
5. For Anthropic: `POST /v1/messages` with `anthropic-version: 2023-06-01`.
6. For TUI integration: launch `aap` (TUI + Server), trigger via curl, confirm new run appears in TUI list with source `http-openai` / `http-anthropic`.

## Conventions

### File naming
Tests are co-located: `foo.ts` → `foo.test.ts`, or under `__tests__/` for feature-grouped tests.

### What to test
- **New function:** happy path + at least one error / edge case.
- **Bug fix:** regression test that reproduces the bug, committed alongside the fix.
- **New conditional branches:** assert both paths.
- **Streaming code:** assert event order, not just final value.

### What NOT to test
- The `dist/` build output (test the source).
- Private internal state of engine/hub (assert events instead).
- ink rendering output (visual; not stable enough to snapshot).

## Closed-loop rule
Don't mark a task complete without running the relevant tests. If you change `voting/calculator.ts`, run `npx vitest src/lib/features/voting --run`. If you change a route, run the curl recipe above.

## Resources
- [Vitest](https://vitest.dev/)
