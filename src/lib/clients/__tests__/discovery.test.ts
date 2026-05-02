import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { listOpenAIModels, listOllamaModels } from '../discovery';

describe('discovery', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function mockFetch(impl: (url: string, init?: RequestInit) => Promise<Response>) {
    const fn = vi.fn(impl as any);
    globalThis.fetch = fn as any;
    return fn;
  }

  describe('listOpenAIModels', () => {
    it('parses {data: [...]} into DiscoveredModel[]', async () => {
      mockFetch(async () =>
        new Response(
          JSON.stringify({
            data: [
              { id: 'gpt-4', object: 'model' },
              { id: 'gpt-3.5-turbo', object: 'model' },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const result = await listOpenAIModels({
        baseUrl: 'http://example.com/v1',
        apiKey: 'sk-test',
      });

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('gpt-4');
      expect(result[1].id).toBe('gpt-3.5-turbo');
    });

    it('strips trailing slashes from baseUrl', async () => {
      const fetchFn = mockFetch(async () =>
        new Response(JSON.stringify({ data: [] }), { status: 200 })
      );

      await listOpenAIModels({
        baseUrl: 'http://example.com/v1///',
        apiKey: 'sk-test',
      });

      const calledUrl = fetchFn.mock.calls[0][0] as string;
      expect(calledUrl).toBe('http://example.com/v1/models');
    });

    it('sends Bearer auth header', async () => {
      const fetchFn = mockFetch(async () =>
        new Response(JSON.stringify({ data: [] }), { status: 200 })
      );

      await listOpenAIModels({
        baseUrl: 'http://example.com/v1',
        apiKey: 'sk-secret',
      });

      const init = fetchFn.mock.calls[0][1] as RequestInit;
      const headers = init.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer sk-secret');
    });

    it('throws on non-2xx with status + body snippet', async () => {
      mockFetch(async () =>
        new Response('upstream rejected: bad key', { status: 401, statusText: 'Unauthorized' })
      );

      await expect(
        listOpenAIModels({ baseUrl: 'http://example.com/v1', apiKey: 'sk-bad' })
      ).rejects.toThrow(/HTTP 401.*upstream rejected/);
    });

    it('throws if response shape is unexpected', async () => {
      mockFetch(async () =>
        new Response(JSON.stringify({ unexpected: 'shape' }), { status: 200 })
      );

      await expect(
        listOpenAIModels({ baseUrl: 'http://example.com/v1', apiKey: 'sk-test' })
      ).rejects.toThrow(/unexpected response shape/);
    });

    it('skips entries without an id field', async () => {
      mockFetch(async () =>
        new Response(
          JSON.stringify({
            data: [{ id: 'good' }, { foo: 'no-id' }, { id: '' }, { id: 'also-good' }],
          }),
          { status: 200 }
        )
      );

      const result = await listOpenAIModels({
        baseUrl: 'http://example.com/v1',
        apiKey: 'sk-test',
      });

      expect(result.map(m => m.id)).toEqual(['good', 'also-good']);
    });

    it('rejects when apiKey is empty', async () => {
      await expect(
        listOpenAIModels({ baseUrl: 'http://example.com/v1', apiKey: '' })
      ).rejects.toThrow(/apiKey is required/);
    });
  });

  describe('listOllamaModels', () => {
    it('parses {models: [{name}]} into DiscoveredModel[]', async () => {
      mockFetch(async () =>
        new Response(
          JSON.stringify({
            models: [
              { name: 'llama3:8b', size: 4_700_000_000 },
              { name: 'mistral:7b' },
            ],
          }),
          { status: 200 }
        )
      );

      const result = await listOllamaModels({ baseUrl: 'http://localhost:11434' });

      expect(result.map(m => m.id)).toEqual(['llama3:8b', 'mistral:7b']);
    });

    it('does not send auth header (Ollama has none)', async () => {
      const fetchFn = mockFetch(async () =>
        new Response(JSON.stringify({ models: [] }), { status: 200 })
      );

      await listOllamaModels({ baseUrl: 'http://localhost:11434' });

      const init = fetchFn.mock.calls[0][1] as RequestInit;
      const headers = (init?.headers ?? {}) as Record<string, string>;
      expect(headers.Authorization).toBeUndefined();
    });

    it('throws on non-2xx', async () => {
      mockFetch(async () => new Response('boom', { status: 500, statusText: 'Server Error' }));

      await expect(
        listOllamaModels({ baseUrl: 'http://localhost:11434' })
      ).rejects.toThrow(/HTTP 500/);
    });
  });
});
