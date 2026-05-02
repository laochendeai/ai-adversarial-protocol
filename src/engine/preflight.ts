/**
 * Run 启动前的健康预检
 *
 * 对每个 ModelConfig：
 *   - openai: 调 GET {baseUrl}/models，确认 endpoint 可达，并验证 model.model 在返回列表中
 *   - ollama: 调 GET {baseUrl}/api/tags 同上
 *   - anthropic: 直接 ok（官方无 list 接口可验）
 *
 * 同 (protocol, baseUrl, apiKey) 的多个模型只触发 1 次发现请求。
 */

import { ModelConfig } from '@/lib/types';
import {
  DiscoveredModel,
  listOpenAIModels,
  listOllamaModels,
} from '@/lib/clients/discovery';

export interface PreflightFailure {
  modelId: string;
  upstreamModel: string;
  reason: string;
}

export interface PreflightResult {
  ok: ModelConfig[];
  failed: PreflightFailure[];
}

export interface PreflightOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

type DiscoveryOutcome =
  | { ok: true; ids: Set<string> }
  | { ok: false; reason: string };

function endpointKey(m: ModelConfig): string {
  return `${m.protocol}::${m.baseUrl}::${m.apiKey}`;
}

async function discoverEndpoint(
  m: ModelConfig,
  opts: PreflightOptions
): Promise<DiscoveryOutcome> {
  try {
    let list: DiscoveredModel[];
    if (m.protocol === 'openai') {
      list = await listOpenAIModels({
        baseUrl: m.baseUrl,
        apiKey: m.apiKey,
        signal: opts.signal,
        timeoutMs: opts.timeoutMs,
      });
    } else if (m.protocol === 'ollama') {
      list = await listOllamaModels({
        baseUrl: m.baseUrl,
        signal: opts.signal,
        timeoutMs: opts.timeoutMs,
      });
    } else {
      // unreachable for callers — anthropic is short-circuited above
      return { ok: false, reason: `protocol ${m.protocol} not supported by preflight` };
    }
    return { ok: true, ids: new Set(list.map(x => x.id)) };
  } catch (err) {
    return {
      ok: false,
      reason: `endpoint 不可达：${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export async function preflightCheck(
  models: ModelConfig[],
  opts: PreflightOptions = {}
): Promise<PreflightResult> {
  const ok: ModelConfig[] = [];
  const failed: PreflightFailure[] = [];

  // Anthropic 直接放行（无 list 接口）
  const verifiable = models.filter(m => m.protocol !== 'anthropic');
  for (const m of models) {
    if (m.protocol === 'anthropic') ok.push(m);
  }

  // 按 endpoint 去重
  const buckets = new Map<string, ModelConfig[]>();
  for (const m of verifiable) {
    const key = endpointKey(m);
    const arr = buckets.get(key) ?? [];
    arr.push(m);
    buckets.set(key, arr);
  }

  // 并发对每个 endpoint 探测一次
  const probes = await Promise.all(
    [...buckets.values()].map(async bucket => {
      const outcome = await discoverEndpoint(bucket[0], opts);
      return { bucket, outcome };
    })
  );

  for (const { bucket, outcome } of probes) {
    if (!outcome.ok) {
      for (const m of bucket) {
        failed.push({ modelId: m.id, upstreamModel: m.model, reason: outcome.reason });
      }
      continue;
    }
    for (const m of bucket) {
      if (outcome.ids.has(m.model)) {
        ok.push(m);
      } else {
        failed.push({
          modelId: m.id,
          upstreamModel: m.model,
          reason: `上游模型名 "${m.model}" 不在 endpoint 返回列表中`,
        });
      }
    }
  }

  return { ok, failed };
}
