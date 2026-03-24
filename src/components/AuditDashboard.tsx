/**
 * 审计质量评分仪表板
 * Audit Quality Score Dashboard
 *
 * 显示AI的可靠性评分和统计信息
 */

'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { AuditMetrics } from '@/lib/types';
import { getAuditSummary, exportAuditData, clearAuditData } from '@/lib/features/audit-metrics';

interface ScoreGrade {
  grade: string;
  color: string;
  description: string;
}

export default function AuditDashboard() {
  const [isOpen, setIsOpen] = useState(false);
  const [summary, setSummary] = useState(getAuditSummary());

  // 从 store 获取审计状态
  const auditState = useAppStore((state) => state.auditState);

  // 刷新统计数据
  const refreshSummary = () => {
    setSummary(getAuditSummary());
  };

  // 获取评分等级
  const getScoreGrade = (score: number): ScoreGrade => {
    if (score === -1) {
      return { grade: 'N/A', color: 'gray', description: '数据不足' };
    }

    if (score >= 90) {
      return { grade: 'A+', color: 'green', description: '优秀' };
    } else if (score >= 80) {
      return { grade: 'A', color: 'green', description: '良好' };
    } else if (score >= 70) {
      return { grade: 'B', color: 'yellow', description: '中等' };
    } else if (score >= 60) {
      return { grade: 'C', color: 'orange', description: '及格' };
    } else {
      return { grade: 'D', color: 'red', description: '需改进' };
    }
  };

  // 获取颜色类名
  const getColorClass = (color: string): string => {
    const colorMap: Record<string, string> = {
      green: 'text-green-600 bg-green-50 border-green-200',
      yellow: 'text-yellow-600 bg-yellow-50 border-yellow-200',
      orange: 'text-orange-600 bg-orange-50 border-orange-200',
      red: 'text-red-600 bg-red-50 border-red-200',
      gray: 'text-gray-600 bg-gray-50 border-gray-200',
    };
    return colorMap[color] || colorMap.gray;
  };

  // 导出数据
  const handleExport = () => {
    const data = exportAuditData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-metrics-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 清除数据
  const handleClear = () => {
    if (confirm('确定要清除所有审计数据吗？此操作不可恢复。')) {
      clearAuditData();
      refreshSummary();
    }
  };

  // 定期刷新统计数据
  useEffect(() => {
    refreshSummary();
    const interval = setInterval(refreshSummary, 5000); // 每5秒刷新一次
    return () => clearInterval(interval);
  }, [auditState]);

  const metricsArray = Object.values(auditState.metrics);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1.5 rounded-lg text-sm font-medium"
      >
        📊 审计评分
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto m-4">
        {/* 标题栏 */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-800">📊 AI审计质量评分</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        {/* 内容 */}
        <div className="p-6">
          {/* 统计摘要 */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">{summary.totalMessages}</div>
                <div className="text-sm text-gray-600">总消息数</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">{summary.totalChallenges}</div>
                <div className="text-sm text-gray-600">总挑刺数</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {summary.mostReliable?.score ?? 'N/A'}
                </div>
                <div className="text-sm text-gray-600">
                  最高: {summary.mostReliable ? (summary.mostReliable.aiId === 'claude' ? 'Claude' : 'OpenAI') : 'N/A'}
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">
                  {summary.leastReliable?.score ?? 'N/A'}
                </div>
                <div className="text-sm text-gray-600">
                  最低: {summary.leastReliable ? (summary.leastReliable.aiId === 'claude' ? 'Claude' : 'OpenAI') : 'N/A'}
                </div>
              </div>
            </div>
          </div>

          {/* AI评分卡片 */}
          <div className="space-y-4 mb-6">
            {metricsArray.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                暂无审计数据。开始对话后，AI的可靠性评分将自动记录。
              </div>
            ) : (
              metricsArray.map((metrics) => {
                const grade = getScoreGrade(metrics.reliabilityScore);
                const aiName = metrics.aiId === 'claude' ? 'Claude' : 'OpenAI';

                return (
                  <div
                    key={metrics.aiId}
                    className={`border-2 rounded-lg p-4 ${getColorClass(grade.color)}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xl font-bold">{aiName}</h3>
                      <div className="text-right">
                        <div className="text-3xl font-bold">
                          {metrics.reliabilityScore === -1 ? 'N/A' : `${metrics.reliabilityScore}/100`}
                        </div>
                        <div className={`text-sm font-medium ${getColorClass(grade.color)}`}>
                          {grade.grade} - {grade.description}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <div className="font-medium">总输出</div>
                        <div className="text-lg">{metrics.totalMessages}</div>
                      </div>
                      <div>
                        <div className="font-medium">被挑刺</div>
                        <div className="text-lg">{metrics.totalChallenges}</div>
                      </div>
                      <div>
                        <div className="font-medium">接受</div>
                        <div className="text-lg">{metrics.acceptedChallenges}</div>
                      </div>
                      <div>
                        <div className="font-medium">拒绝</div>
                        <div className="text-lg">{metrics.rejectedChallenges}</div>
                      </div>
                    </div>

                    {metrics.totalChallenges > 0 && (
                      <div className="mt-3 pt-3 border-t border-current border-opacity-20">
                        <div className="text-xs mb-1">挑刺类型:</div>
                        <div className="grid grid-cols-5 gap-2 text-xs">
                          <div>事实: {metrics.challengesByType.factualError}</div>
                          <div>逻辑: {metrics.challengesByType.logicalFlaw}</div>
                          <div>遗漏: {metrics.challengesByType.omission}</div>
                          <div>不清: {metrics.challengesByType.unclear}</div>
                          <div>其他: {metrics.challengesByType.other}</div>
                        </div>
                        <div className="text-xs mt-2">
                          严重性: 高 {metrics.challengesBySeverity.high} |{' '}
                          中 {metrics.challengesBySeverity.medium} |{' '}
                          低 {metrics.challengesBySeverity.low}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-3">
            <button
              onClick={refreshSummary}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium"
            >
              🔄 刷新
            </button>
            <button
              onClick={handleExport}
              className="flex-1 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-medium"
              disabled={metricsArray.length === 0}
            >
              📥 导出数据
            </button>
            <button
              onClick={handleClear}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium"
              disabled={metricsArray.length === 0}
            >
              🗑️ 清除数据
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
