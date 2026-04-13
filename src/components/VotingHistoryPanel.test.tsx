import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import VotingHistoryPanel from './VotingHistoryPanel';

describe('VotingHistoryPanel', () => {
  it('renders recent voting history entries', () => {
    render(
      <VotingHistoryPanel
        history={[
          {
            id: 'history-1',
            createdAt: Date.now(),
            result: {
              topicId: 'vote-1',
              votes: [
                { id: 'v1', topicId: 'vote-1', voterId: 'claude', choice: 'msg-1', timestamp: Date.now() },
              ],
              totals: { 'msg-1': 1 },
              winner: 'msg-1',
              consensusLevel: 1,
              isTie: false,
              isUnanimous: true,
              requiresReview: false,
            },
          },
        ]}
      />
    );

    expect(screen.getByText('🕘 投票历史')).toBeInTheDocument();
    expect(screen.getByText(/主题: vote-1/)).toBeInTheDocument();
    expect(screen.getByText(/获胜者: msg-1/)).toBeInTheDocument();
  });
});
