import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeSearchHandler } from '../search';
import { makeFetchUrlHandler } from '../fetch';
import { makeConcedeHandler, InMemoryConcessionTracker } from '../concede';

const ctx = { modelId: 'm', runId: 'r' } as const;

describe('search tool', () => {
  let originalFetch: typeof globalThis.fetch;
  beforeEach(() => { originalFetch = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = originalFetch; vi.restoreAllMocks(); });

  it('hits SearXNG /search?format=json with engines param', async () => {
    const fetchFn = vi.fn(async () =>
      new Response(JSON.stringify({ results: [
        { title: 'T1', url: 'http://x/1', content: 'snip1' },
        { title: 'T2', url: 'http://x/2', content: 'snip2' },
      ] }), { status: 200 })
    );
    globalThis.fetch = fetchFn as any;

    const handler = makeSearchHandler({ baseUrl: 'http://localhost:28080' });
    const result = await handler({ query: 'rust ownership', num_results: 2 }, ctx);

    expect(result.ok).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const calledUrl = fetchFn.mock.calls[0][0] as string;
    expect(calledUrl).toContain('/search?');
    expect(calledUrl).toContain('format=json');
    expect(calledUrl).toContain('engines=bing');
    if (result.ok) {
      expect(result.content).toContain('[1] T1');
      expect(result.content).toContain('http://x/1');
      expect(result.content).toContain('[2] T2');
    }
  });

  it('rejects empty query', async () => {
    globalThis.fetch = vi.fn() as any;
    const handler = makeSearchHandler({ baseUrl: 'http://localhost:28080' });
    const result = await handler({ query: '   ' }, ctx);
    expect(result.ok).toBe(false);
  });

  it('handles SearXNG error response', async () => {
    globalThis.fetch = vi.fn(async () => new Response('rate limited', { status: 429 })) as any;
    const handler = makeSearchHandler({ baseUrl: 'http://localhost:28080' });
    const result = await handler({ query: 'x' }, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/HTTP 429/);
  });

  it('reports empty result set explicitly', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ results: [] }), { status: 200 })
    ) as any;
    const handler = makeSearchHandler({ baseUrl: 'http://localhost:28080' });
    const result = await handler({ query: 'nonsensequerythatreturnsnothing' }, ctx);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.content).toMatch(/No results/);
  });
});

describe('fetch_url tool', () => {
  let originalFetch: typeof globalThis.fetch;
  beforeEach(() => { originalFetch = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = originalFetch; vi.restoreAllMocks(); });

  it('strips HTML and returns readable text', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response('<html><body><h1>Title</h1><p>Hello <b>world</b></p><script>x()</script></body></html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      })
    ) as any;
    const handler = makeFetchUrlHandler();
    const result = await handler({ url: 'http://example.com' }, ctx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.content).toContain('Title');
      expect(result.content).toContain('Hello world');
      expect(result.content).not.toContain('<script>');
      expect(result.content).not.toContain('x()');
    }
  });

  it('rejects non-http URLs', async () => {
    const handler = makeFetchUrlHandler();
    const result = await handler({ url: 'file:///etc/passwd' }, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/http\/https/);
  });

  it('rejects binary content-type', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(new Uint8Array([0, 1, 2]), {
        status: 200,
        headers: { 'content-type': 'application/octet-stream' },
      })
    ) as any;
    const handler = makeFetchUrlHandler();
    const result = await handler({ url: 'http://example.com/x.bin' }, ctx);
    expect(result.ok).toBe(false);
  });

  it('truncates content at maxBytes', async () => {
    const big = 'A'.repeat(20000);
    globalThis.fetch = vi.fn(async () =>
      new Response(big, { status: 200, headers: { 'content-type': 'text/plain' } })
    ) as any;
    const handler = makeFetchUrlHandler({ maxBytes: 100 });
    const result = await handler({ url: 'http://example.com' }, ctx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.content).toContain('[truncated]');
      expect(result.content.length).toBeLessThan(500);
    }
  });
});

describe('concede tool', () => {
  it('records concession in tracker', async () => {
    const tracker = new InMemoryConcessionTracker();
    const handler = makeConcedeHandler(tracker);
    const result = await handler(
      { reason: 'search showed I was wrong about the date', defer_to: 'qwen-235b' },
      { modelId: 'glm-4.7', runId: 'r1' }
    );
    expect(result.ok).toBe(true);
    expect(tracker.isWithdrawn('glm-4.7')).toBe(true);
    expect(tracker.isWithdrawn('qwen-235b')).toBe(false);
    expect(tracker.list()).toHaveLength(1);
    expect(tracker.list()[0].deferTo).toBe('qwen-235b');
  });

  it('rejects empty reason', async () => {
    const tracker = new InMemoryConcessionTracker();
    const handler = makeConcedeHandler(tracker);
    const result = await handler({ reason: '   ' }, { modelId: 'm', runId: 'r' });
    expect(result.ok).toBe(false);
    expect(tracker.list()).toHaveLength(0);
  });

  it('first concession sticks (subsequent calls ignored)', async () => {
    const tracker = new InMemoryConcessionTracker();
    const handler = makeConcedeHandler(tracker);
    await handler({ reason: 'first' }, { modelId: 'm', runId: 'r' });
    await handler({ reason: 'second' }, { modelId: 'm', runId: 'r' });
    expect(tracker.list()).toHaveLength(1);
    expect(tracker.list()[0].reason).toBe('first');
  });
});
