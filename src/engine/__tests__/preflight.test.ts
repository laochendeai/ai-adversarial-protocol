import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { preflightCheck } from '../preflight';
import type { ModelConfig } from '@/lib/types';

function mc(overrides: Partial<ModelConfig> & { id: string; model: string }): ModelConfig {
  return {
    protocol: 'openai',
    baseUrl: 'http://example.com/v1',
    apiKey: 'sk-test',
    enabled: true,
    weight: 1,
    ...overrides,
  };
}

describe('preflightCheck', () => {
  let originalFetch: typeof globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as any;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('marks all models ok when discovery succeeds and names match', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: 'gpt-4' }, { id: 'gpt-3.5' }] }), {
        status: 200,
      })
    );

    const result = await preflightCheck([
      mc({ id: 'a', model: 'gpt-4' }),
      mc({ id: 'b', model: 'gpt-3.5' }),
    ]);

    expect(result.failed).toHaveLength(0);
    expect(result.ok.map(m => m.id)).toEqual(['a', 'b']);
  });

  it('flags models whose upstream name is not in /v1/models response', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: 'gpt-4' }] }), { status: 200 })
    );

    const result = await preflightCheck([
      mc({ id: 'a', model: 'gpt-4' }),
      mc({ id: 'b', model: 'does-not-exist' }),
    ]);

    expect(result.ok.map(m => m.id)).toEqual(['a']);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].modelId).toBe('b');
    expect(result.failed[0].reason).toMatch(/不在 endpoint 返回列表中/);
  });

  it('flags every model on an unreachable endpoint with the same reason', async () => {
    fetchMock.mockResolvedValue(new Response('boom', { status: 500 }));

    const result = await preflightCheck([
      mc({ id: 'a', model: 'gpt-4' }),
      mc({ id: 'b', model: 'gpt-3.5' }),
    ]);

    expect(result.ok).toHaveLength(0);
    expect(result.failed).toHaveLength(2);
    expect(result.failed.every(f => f.reason.includes('endpoint 不可达'))).toBe(true);
  });

  it('dedupes endpoints: same (protocol, baseUrl, apiKey) → one fetch for N models', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }] }), {
        status: 200,
      })
    );

    await preflightCheck([
      mc({ id: 'a', model: 'm1' }),
      mc({ id: 'b', model: 'm2' }),
      mc({ id: 'c', model: 'm3' }),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does NOT dedupe across different baseUrls', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: 'x' }] }), { status: 200 })
    );

    await preflightCheck([
      mc({ id: 'a', model: 'x', baseUrl: 'http://one.com/v1' }),
      mc({ id: 'b', model: 'x', baseUrl: 'http://two.com/v1' }),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('lets anthropic models through without verification', async () => {
    // No fetch should be made for anthropic-only input.
    const result = await preflightCheck([
      mc({ id: 'claude', model: 'claude-3-5-sonnet', protocol: 'anthropic' }),
    ]);

    expect(result.ok).toHaveLength(1);
    expect(result.failed).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses ollama /api/tags for ollama models', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ models: [{ name: 'llama3:8b' }] }), { status: 200 })
    );

    const result = await preflightCheck([
      mc({
        id: 'local',
        model: 'llama3:8b',
        protocol: 'ollama',
        baseUrl: 'http://localhost:11434',
        apiKey: '',
      }),
    ]);

    expect(result.ok.map(m => m.id)).toEqual(['local']);
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toBe('http://localhost:11434/api/tags');
  });

  it('mixed: 1 ok, 1 unreachable endpoint, 1 wrong name', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.startsWith('http://good.com')) {
        return new Response(JSON.stringify({ data: [{ id: 'real-model' }] }), { status: 200 });
      }
      return new Response('nope', { status: 503 });
    });

    const result = await preflightCheck([
      mc({ id: 'a', model: 'real-model', baseUrl: 'http://good.com/v1' }),
      mc({ id: 'b', model: 'fake-name', baseUrl: 'http://good.com/v1' }),
      mc({ id: 'c', model: 'whatever', baseUrl: 'http://broken.com/v1' }),
    ]);

    expect(result.ok.map(m => m.id)).toEqual(['a']);
    expect(result.failed).toHaveLength(2);
    const failedB = result.failed.find(f => f.modelId === 'b');
    const failedC = result.failed.find(f => f.modelId === 'c');
    expect(failedB?.reason).toMatch(/不在 endpoint 返回列表中/);
    expect(failedC?.reason).toMatch(/endpoint 不可达/);
  });
});
