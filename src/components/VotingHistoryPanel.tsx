import { VotingHistoryEntry } from '@/lib/types';

interface VotingHistoryPanelProps {
  history: VotingHistoryEntry[];
}

export default function VotingHistoryPanel({ history }: VotingHistoryPanelProps) {
  if (history.length === 0) return null;

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-6">
      <h3 className="text-lg font-semibold mb-3">🕘 投票历史</h3>
      <div className="space-y-2">
        {history.slice(0, 5).map((entry) => (
          <div key={entry.id} className="p-3 bg-gray-50 rounded border border-gray-200">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="font-medium text-gray-800">
                主题: {entry.result.topicId}
              </span>
              <span className="text-gray-500">
                {new Date(entry.createdAt).toLocaleString()}
              </span>
            </div>
            <div className="text-sm text-gray-700">
              获胜者: {entry.result.winner || '无明确获胜者'}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              共识度: {(entry.result.consensusLevel * 100).toFixed(0)}% · 投票数: {entry.result.votes.length}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
