import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { probeToolCalling } from '../capability-probe';
import type { ModelConfig } from '@/lib/types';

const model: ModelConfig = {
  id: 'm', protocol: 'openai',
  baseUrl: 'http://example.com/v1',
  apiKey: 'sk-test',
  model: 'mock',
  enabled: true,
};

describe('probeToolCalling', () => {
  let originalFetch: typeof globalThis.fetch;
  beforeEach(() => { originalFetch = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = originalFetch; vi.restoreAllMocks(); });

  it('marks supported when model returns calculate tool_call', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({
        choices: [{
          message: {
            content: '',
            tool_calls: [{ id: 'c1', function: { name: 'calculate', arguments: '{"expression":"7*8"}' } }],
          },
          finish_reason: 'tool_calls',
        }],
      }), { status: 200 })
    ) as any;

    const r = await probeToolCalling(model);
    expect(r.supported).toBe(true);
    expect(r.reason).toMatch(/calculate/);
  });

  it('marks unsupported when model returns plain text', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({
        choices: [{ message: { content: '56' }, finish_reason: 'stop' }],
      }), { status: 200 })
    ) as any;

    const r = await probeToolCalling(model);
    expect(r.supported).toBe(false);
    expect(r.reason).toMatch(/text content/);
  });

  it('marks unsupported when finish=tool_calls but payload is empty', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({
        choices: [{ message: { content: '', tool_calls: [] }, finish_reason: 'tool_calls' }],
      }), { status: 200 })
    ) as any;

    const r = await probeToolCalling(model);
    expect(r.supported).toBe(false);
    expect(r.reason).toMatch(/no parseable tool_calls/);
  });

  it('marks unsupported on HTTP error', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response('boom', { status: 500 })
    ) as any;

    const r = await probeToolCalling(model);
    expect(r.supported).toBe(false);
    expect(r.reason).toMatch(/probe failed/);
  });
});
