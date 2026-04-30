/**
 * 审计指标持久化 — 文件系统版本
 * Stores `~/.aap/audit-metrics.json`
 */

import { readFileSync, writeFileSync, renameSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { AuditState, AuditMetrics } from '@/lib/types';
import { ensureStorageDir, DEFAULT_STORAGE_DIR } from '@/config/loader';
import { createInitialMetrics } from './calculator';

const FILENAME = 'audit-metrics.json';

function getPath(storageDir: string): string {
  return join(storageDir, FILENAME);
}

export function loadAuditState(storageDir = DEFAULT_STORAGE_DIR): AuditState {
  const path = getPath(storageDir);
  if (!existsSync(path)) {
    return { metrics: {} };
  }
  try {
    const raw = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      metrics: parsed.metrics ?? {},
    };
  } catch {
    return { metrics: {} };
  }
}

function atomicWrite(state: AuditState, storageDir: string): void {
  ensureStorageDir(storageDir);
  const finalPath = getPath(storageDir);
  const tmpPath = `${finalPath}.tmp.${process.pid}.${Date.now()}`;
  writeFileSync(tmpPath, JSON.stringify(state, null, 2), 'utf-8');
  try {
    renameSync(tmpPath, finalPath);
  } catch (err) {
    try { unlinkSync(tmpPath); } catch { /* ignore */ }
    throw err;
  }
}

export function saveAuditState(
  state: AuditState,
  storageDir = DEFAULT_STORAGE_DIR
): void {
  atomicWrite(state, storageDir);
}

export function getMetrics(modelId: string, storageDir = DEFAULT_STORAGE_DIR): AuditMetrics {
  const state = loadAuditState(storageDir);
  return state.metrics[modelId] ?? createInitialMetrics(modelId);
}

// Module-level mutex serialises all metric writes so concurrent runs
// (HTTP + TUI, or multiple HTTP) don't lose updates via read-modify-write races.
let writeQueue: Promise<void> = Promise.resolve();

export function updateMetrics(
  modelId: string,
  metrics: AuditMetrics,
  storageDir = DEFAULT_STORAGE_DIR
): Promise<void> {
  const next = writeQueue.then(() => {
    const state = loadAuditState(storageDir);
    state.metrics[modelId] = metrics;
    atomicWrite(state, storageDir);
  });
  writeQueue = next.catch(() => { /* swallow so chain stays alive */ });
  return next;
}

export function clearAuditData(storageDir = DEFAULT_STORAGE_DIR): Promise<void> {
  const next = writeQueue.then(() => atomicWrite({ metrics: {} }, storageDir));
  writeQueue = next.catch(() => { /* swallow */ });
  return next;
}

export function getAuditSummary(storageDir = DEFAULT_STORAGE_DIR): {
  totalMessages: number;
  totalChallenges: number;
  mostReliable: { modelId: string; score: number } | null;
  leastReliable: { modelId: string; score: number } | null;
} {
  const state = loadAuditState(storageDir);
  const arr = Object.values(state.metrics);
  if (arr.length === 0) {
    return { totalMessages: 0, totalChallenges: 0, mostReliable: null, leastReliable: null };
  }
  const totalMessages = arr.reduce((sum, m) => sum + m.totalMessages, 0);
  const totalChallenges = arr.reduce((sum, m) => sum + m.totalChallenges, 0);
  const valid = arr.filter(m => m.reliabilityScore >= 0);
  if (valid.length === 0) {
    return { totalMessages, totalChallenges, mostReliable: null, leastReliable: null };
  }
  const sorted = [...valid].sort((a, b) => b.reliabilityScore - a.reliabilityScore);
  return {
    totalMessages,
    totalChallenges,
    mostReliable: { modelId: sorted[0].modelId, score: sorted[0].reliabilityScore },
    leastReliable: {
      modelId: sorted[sorted.length - 1].modelId,
      score: sorted[sorted.length - 1].reliabilityScore,
    },
  };
}
