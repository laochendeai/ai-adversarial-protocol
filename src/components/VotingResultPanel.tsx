/**
 * 投票结果展示面板
 * Voting Result Panel
 */

'use client';

import { VotingResult, Vote } from '@/lib/types';

interface VotingResultPanelProps {
  result: VotingResult;
  messages: Array<{ id: string; content: string; isClaude?: boolean }>;
  onClose?: () => void;
}

export default function VotingResultPanel({
  result,
  messages,
  onClose,
}: VotingResultPanelProps) {
  const getMessageLabel = (messageId: string) => {
    const msg = messages.find(m => m.id === messageId);
    if (!msg) return messageId;

    const aiName = msg.isClaude === undefined ? '未知' : (msg.isClaude ? 'Claude' : 'OpenAI');
    const preview = msg.content.substring(0, 50);
    return `${aiName}: "${preview}${msg.content.length > 50 ? '...' : ''}"`;
  };

  const getConsensusColor = (level: number) => {
    if (level >= 0.9) return 'text-green-600 bg-green-50';
    if (level >= 0.7) return 'text-blue-600 bg-blue-50';
    if (level >= 0.5) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getConsensusLabel = (level: number) => {
    if (level >= 0.9) return '强共识';
    if (level >= 0.7) return '中等共识';
    if (level >= 0.5) return '弱共识';
    return '无共识';
  };

  const totalVotes = result.votes.length;
  const maxVotes = Math.max(...Object.values(result.totals));

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-6">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          🗳️ 投票结果
          {onClose && (
            <button
              onClick={onClose}
              className="text-sm font-normal text-gray-500 hover:text-gray-700"
            >
              关闭
            </button>
          )}
        </h3>
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${getConsensusColor(result.consensusLevel)}`}>
          {getConsensusLabel(result.consensusLevel)} ({(result.consensusLevel * 100).toFixed(0)}%)
        </div>
      </div>

      {/* 获胜者 */}
      {result.winner && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="font-medium text-blue-900 mb-1">🏆 获胜答案</div>
          <div className="text-sm text-blue-800">
            {getMessageLabel(result.winner)}
          </div>
          <div className="text-xs text-blue-600 mt-1">
            得票率: {((result.totals[result.winner] / totalVotes) * 100).toFixed(1)}%
          </div>
        </div>
      )}

      {/* 平局提示 */}
      {result.isTie && (
        <div className="mb-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
          <div className="font-medium text-yellow-900">⚠️ 投票平局</div>
          <div className="text-sm text-yellow-800 mt-1">
            多个选项获得相同票数，需要人工决定
          </div>
        </div>
      )}

      {/* 需要审查提示 */}
      {result.requiresReview && (
        <div className="mb-4 p-3 bg-red-50 rounded-lg border border-red-200">
          <div className="font-medium text-red-900">⚠️ 需要人工审查</div>
          <div className="text-sm text-red-800 mt-1">
            共识度不足或存在平局，建议人工审核
          </div>
        </div>
      )}

      {/* 得票详情 */}
      <div className="mb-4">
        <h4 className="font-medium text-gray-700 mb-2">得票统计</h4>
        <div className="space-y-2">
          {Object.entries(result.totals)
            .sort((a, b) => b[1] - a[1])
            .map(([optionId, votes]) => {
              const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
              const isWinner = optionId === result.winner;

              return (
                <div key={optionId} className="relative">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm ${isWinner ? 'font-medium' : ''}`}>
                      {isWinner && '🏆 '}
                      {getMessageLabel(optionId)}
                    </span>
                    <span className="text-sm text-gray-600">
                      {votes} 票 ({percentage.toFixed(1)}%)
                    </span>
                  </div>
                  {/* 进度条 */}
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${isWinner ? 'bg-blue-500' : 'bg-gray-400'}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* 投票详情 */}
      <div>
        <h4 className="font-medium text-gray-700 mb-2">投票详情</h4>
        <div className="space-y-2">
          {result.votes.map((vote) => {
            const getVoterEmoji = (voterId: string) => {
              switch (voterId) {
                case 'claude': return '🧠';
                case 'openai': return '🤖';
                case 'gemini': return '✨';
                case 'local': return '💻';
                default: return '❓';
              }
            };

            return (
              <div
                key={vote.id}
                className="p-2 bg-gray-50 rounded border border-gray-200"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-gray-800">
                    <span className="mr-1">{getVoterEmoji(vote.voterId)}</span>
                    {vote.voterId.toUpperCase()}
                  </span>
                  {vote.confidence !== undefined && (
                    <span className="text-xs text-gray-500">
                      置信度: {(vote.confidence * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-700 mb-1">
                  选择: {getMessageLabel(vote.choice)}
                </div>
                {vote.reasoning && (
                  <div className="text-xs text-gray-600 italic">
                    "{vote.reasoning}"
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 一致同意标识 */}
      {result.isUnanimous && (
        <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200 text-center">
          <span className="text-green-800 font-medium">✅ 所有AI达成一致意见</span>
        </div>
      )}
    </div>
  );
}
