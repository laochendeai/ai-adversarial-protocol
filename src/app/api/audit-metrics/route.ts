/**
 * 审计质量评分 API
 * Audit Metrics API Endpoint
 *
 * GET /api/audit-metrics - 获取审计指标和统计摘要
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuditSummary, loadAuditState } from '@/lib/features/audit-metrics';

export async function GET(request: NextRequest) {
  try {
    // 获取审计状态
    const auditState = loadAuditState();

    // 获取统计摘要
    const summary = getAuditSummary();

    // 返回数据
    return NextResponse.json({
      success: true,
      data: {
        metrics: Object.values(auditState.metrics),
        history: auditState.history,
        summary,
      },
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
