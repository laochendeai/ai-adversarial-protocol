/**
 * 能力缓存：~/.aap/capabilities.json
 *
 * 探测一次模型 tool-calling 能力很贵（~50 token），结果缓存 24h。
 * 用户改 baseUrl/apiKey/upstream model 后必须用 `aap probe` 强刷。
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ProbeResult } from './capability-probe';

export interface CapabilityCache {
  version: 1;
  /** keyed by ModelConfig.id */
  models: Record<string, ProbeResult>;
}

const FILENAME = 'capabilities.json';

function emptyCache(): CapabilityCache {
  return { version: 1, models: {} };
}

export function capabilityCachePath(storageDir: string): string {
  return join(storageDir, FILENAME);
}

export function loadCapabilityCache(storageDir: string): CapabilityCache {
  const path = capabilityCachePath(storageDir);
  if (!existsSync(path)) return emptyCache();
  try {
    const raw = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<CapabilityCache>;
    if (parsed.version !== 1 || typeof parsed.models !== 'object') return emptyCache();
    return { version: 1, models: parsed.models as Record<string, ProbeResult> };
  } catch {
    return emptyCache();
  }
}

export function saveCapabilityCache(storageDir: string, cache: CapabilityCache): void {
  if (!existsSync(storageDir)) mkdirSync(storageDir, { recursive: true });
  writeFileSync(capabilityCachePath(storageDir), JSON.stringify(cache, null, 2), 'utf-8');
}

export function setCapability(
  storageDir: string,
  modelId: string,
  result: ProbeResult
): void {
  const cache = loadCapabilityCache(storageDir);
  cache.models[modelId] = result;
  saveCapabilityCache(storageDir, cache);
}

export function getCapability(
  storageDir: string,
  modelId: string,
  ttlHours: number
): ProbeResult | undefined {
  const cache = loadCapabilityCache(storageDir);
  const entry = cache.models[modelId];
  if (!entry) return undefined;
  const ageMs = Date.now() - entry.probedAt;
  if (ageMs > ttlHours * 3600 * 1000) return undefined;
  return entry;
}
