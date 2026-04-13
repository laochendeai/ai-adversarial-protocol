/**
 * 审计质量评分 API
 * Audit Metrics API Endpoint
 *
 * GET /api/audit-metrics - 获取审计指标和统计摘要
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuditSummary, loadAuditState } from '@/lib/features/audit-metrics';
import { votingCache } from '@/lib/server-cache';

export async function GET(request: NextRequest) {
  try {
    // Generate cache key based on query parameters
    const url = new URL(request.url);
    const cacheKey = `audit-metrics:${url.search}`;

    // Check cache first
    const cached = votingCache.get(cacheKey);
    if (cached) {
      return NextResponse.json({
        success: true,
        data: cached,
        cached: true,
      });
    }

    // 获取审计状态
    const auditState = loadAuditState();

    // 获取统计摘要
    const summary = getAuditSummary();

    const data = {
      metrics: Object.values(auditState.metrics),
      history: auditState.history,
      summary,
    };

    // Store in cache (30 second TTL)
    votingCache.set(cacheKey, data, 30000);

    // 返回数据
    return NextResponse.json({
      success: true,
      data,
      cached: false,
    });
  } catch (error) {
    console.error('Error fetching audit metrics:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
