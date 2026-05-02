/**
 * 模型发现：调用各协议的 list-models 端点
 *   - OpenAI 兼容: GET {baseUrl}/models  (Bearer auth)
 *   - Ollama:     GET {baseUrl}/api/tags
 *
 * Anthropic 没有公开 list 接口，由调用方自行处理。
 */

export interface DiscoveredModel {
  id: string;
  raw?: unknown;
}

const DEFAULT_TIMEOUT_MS = 5000;

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function withTimeout(
  signal: AbortSignal | undefined,
  timeoutMs: number
): { signal: AbortSignal; cancel: () => void } {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs);
  if (signal) {
    if (signal.aborted) ctrl.abort(signal.reason);
    else signal.addEventListener('abort', () => ctrl.abort(signal.reason), { once: true });
  }
  return {
    signal: ctrl.signal,
    cancel: () => clearTimeout(timer),
  };
}

async function fetchJson(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<unknown> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal: outer, ...rest } = init;
  const { signal, cancel } = withTimeout(outer ?? undefined, timeoutMs);
  let response: Response;
  try {
    response = await fetch(url, { ...rest, signal });
  } finally {
    cancel();
  }
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const snippet = body.length > 200 ? body.slice(0, 200) + '…' : body;
    throw new Error(
      `HTTP ${response.status} ${response.statusText} ${url}${snippet ? ` — ${snippet}` : ''}`
    );
  }
  return response.json();
}

export async function listOpenAIModels(opts: {
  baseUrl: string;
  apiKey: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<DiscoveredModel[]> {
  if (!opts.apiKey) {
    throw new Error('listOpenAIModels: apiKey is required');
  }
  const url = `${normalizeBaseUrl(opts.baseUrl)}/models`;
  const data = (await fetchJson(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${opts.apiKey}` },
    signal: opts.signal,
    timeoutMs: opts.timeoutMs,
  })) as { data?: Array<{ id?: string }> };

  if (!data || !Array.isArray(data.data)) {
    throw new Error(`listOpenAIModels: unexpected response shape from ${url}`);
  }
  return data.data
    .filter((m): m is { id: string } => typeof m?.id === 'string' && m.id.length > 0)
    .map(m => ({ id: m.id, raw: m }));
}

export async function listOllamaModels(opts: {
  baseUrl: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<DiscoveredModel[]> {
  const url = `${normalizeBaseUrl(opts.baseUrl)}/api/tags`;
  const data = (await fetchJson(url, {
    method: 'GET',
    signal: opts.signal,
    timeoutMs: opts.timeoutMs,
  })) as { models?: Array<{ name?: string }> };

  if (!data || !Array.isArray(data.models)) {
    throw new Error(`listOllamaModels: unexpected response shape from ${url}`);
  }
  return data.models
    .filter((m): m is { name: string } => typeof m?.name === 'string' && m.name.length > 0)
    .map(m => ({ id: m.name, raw: m }));
}
