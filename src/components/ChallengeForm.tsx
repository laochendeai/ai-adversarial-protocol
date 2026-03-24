'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Challenge } from '@/lib/types';

interface ChallengeFormProps {
  messageIndex: number;
  isOpen: boolean;
  onClose: () => void;
}

export default function ChallengeForm({ messageIndex, isOpen, onClose }: ChallengeFormProps) {
  const [reason, setReason] = useState('');
  const addChallenge = useAppStore((state) => state.addChallenge);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!reason.trim()) return;

    const challenge: Challenge = {
      id: Date.now().toString(),
      messageIndex,
      reason: reason.trim(),
      timestamp: Date.now(),
    };

    addChallenge(challenge);
    setReason('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-semibold">🎯 挑战此回复</h3>
          <p className="text-sm text-gray-500 mt-1">
            你认为这条回复有什么问题？
          </p>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            挑战原因
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="例如：数据不准确、逻辑错误、缺少关键信息等..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-500"
            rows={4}
            autoFocus
          />
          <p className="text-xs text-gray-500 mt-2">
            挑战记录将显示在"挑战记录"面板中
          </p>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={!reason.trim()}
            className={`flex-1 py-2 px-4 rounded-lg font-semibold ${
              reason.trim()
                ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                : 'bg-gray-200 cursor-not-allowed text-gray-400'
            }`}
          >
            保存挑战
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 px-4 rounded-lg"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
