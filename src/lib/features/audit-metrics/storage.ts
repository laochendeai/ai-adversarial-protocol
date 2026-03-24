/**
 * 审计指标持久化存储
 * Audit Metrics Storage
 */

import { AuditState, AuditMetrics } from '@/lib/types';
import { createInitialMetrics } from './calculator';

const AUDIT_STORAGE_KEY = 'ai-adversarial-audit-metrics';
const AUDIT_HISTORY_KEY = 'ai-adversarial-audit-history';

/**
 * 加载审计状态
 * Load audit state from localStorage
 */
export function loadAuditState(): AuditState {
  if (typeof window === 'undefined') {
    return { metrics: {}, history: [] };
  }

  try {
    const metricsData = localStorage.getItem(AUDIT_STORAGE_KEY);
    const historyData = localStorage.getItem(AUDIT_HISTORY_KEY);

    const metrics: Record<string, AuditMetrics> = metricsData
      ? JSON.parse(metricsData)
      : {};

    const history: AuditState['history'] = historyData
      ? JSON.parse(historyData)
      : [];

    return { metrics, history };
  } catch (error) {
    console.error('Failed to load audit state:', error);
    return { metrics: {}, history: [] };
  }
}

/**
 * 保存审计状态
 * Save audit state to localStorage
 */
export function saveAuditState(state: AuditState): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(state.metrics));
    localStorage.setItem(AUDIT_HISTORY_KEY, JSON.stringify(state.history));
  } catch (error) {
    console.error('Failed to save audit state:', error);
  }
}

/**
 * 获取AI的审计指标
 * Get audit metrics for a specific AI
 */
export function getMetrics(aiId: string): AuditMetrics {
  const state = loadAuditState();

  if (!state.metrics[aiId]) {
    return createInitialMetrics(aiId);
  }

  return state.metrics[aiId];
}

/**
 * 更新AI的审计指标
 * Update audit metrics for a specific AI
 */
export function updateMetrics(aiId: string, metrics: AuditMetrics): void {
  const state = loadAuditState();
  state.metrics[aiId] = metrics;
  saveAuditState(state);
}

/**
 * 添加历史记录
 * Add entry to audit history
 */
export function addHistoryEntry(entry: AuditState['history'][0]): void {
  const state = loadAuditState();
  state.history.push(entry);

  // 只保留最近1000条记录
  if (state.history.length > 1000) {
    state.history = state.history.slice(-1000);
  }

  saveAuditState(state);
}

/**
 * 清除所有审计数据
 * Clear all audit data
 */
export function clearAuditData(): void {
  if (typeof window === 'undefined') return;

  localStorage.removeItem(AUDIT_STORAGE_KEY);
  localStorage.removeItem(AUDIT_HISTORY_KEY);
}

/**
 * 导出审计数据
 * Export audit data as JSON
 */
export function exportAuditData(): string {
  const state = loadAuditState();

  return JSON.stringify(
    {
      exportDate: new Date().toISOString(),
      version: '1.0',
      metrics: state.metrics,
      history: state.history,
    },
    null,
    2
  );
}

/**
 * 导入审计数据
 * Import audit data from JSON
 */
export function importAuditData(jsonData: string): boolean {
  try {
    const data = JSON.parse(jsonData);

    if (!data.metrics || !data.version) {
      throw new Error('Invalid audit data format');
    }

    const state: AuditState = {
      metrics: data.metrics,
      history: data.history || [],
    };

    saveAuditState(state);
    return true;
  } catch (error) {
    console.error('Failed to import audit data:', error);
    return false;
  }
}

/**
 * 获取审计统计摘要
 * Get audit statistics summary
 */
export function getAuditSummary(): {
  totalMessages: number;
  totalChallenges: number;
  mostReliable: { aiId: string; score: number } | null;
  leastReliable: { aiId: string; score: number } | null;
} {
  const state = loadAuditState();
  const metricsArray = Object.values(state.metrics);

  if (metricsArray.length === 0) {
    return {
      totalMessages: 0,
      totalChallenges: 0,
      mostReliable: null,
      leastReliable: null,
    };
  }

  const totalMessages = metricsArray.reduce((sum, m) => sum + m.totalMessages, 0);
  const totalChallenges = metricsArray.reduce((sum, m) => sum + m.totalChallenges, 0);

  // 找出最可靠和最不可靠的AI
  const validMetrics = metricsArray.filter(m => m.reliabilityScore >= 0);

  let mostReliable: { aiId: string; score: number } | null = null;
  let leastReliable: { aiId: string; score: number } | null = null;

  if (validMetrics.length > 0) {
    const sorted = validMetrics.sort((a, b) => b.reliabilityScore - a.reliabilityScore);
    mostReliable = {
      aiId: sorted[0].aiId,
      score: sorted[0].reliabilityScore,
    };
    leastReliable = {
      aiId: sorted[sorted.length - 1].aiId,
      score: sorted[sorted.length - 1].reliabilityScore,
    };
  }

  return {
    totalMessages,
    totalChallenges,
    mostReliable,
    leastReliable,
  };
}
