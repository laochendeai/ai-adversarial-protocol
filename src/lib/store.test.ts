import { describe, it, expect } from 'vitest';
import { useAppStore } from './store';

describe('store challenge status updates', () => {
  it('updates challenge status by id', () => {
    useAppStore.setState({
      debateState: {
        messages: [],
        challenges: [
          {
            id: 'challenge-1',
            messageIndex: 0,
            reason: 'Test challenge',
            timestamp: Date.now(),
            status: 'pending',
          },
        ],
        isStreaming: false,
        tokenCount: { claude: 0, openai: 0 },
      },
    });

    useAppStore.getState().updateChallengeStatus('challenge-1', 'accepted');

    const updatedChallenge = useAppStore.getState().debateState.challenges[0];
    expect(updatedChallenge.status).toBe('accepted');
  });
});

describe('store voting history', () => {
  it('adds voting history entries in reverse chronological order', () => {
    useAppStore.setState({
      votingHistory: { history: [] },
    });

    useAppStore.getState().addVotingHistoryEntry({
      topicId: 'vote-1',
      votes: [],
      totals: {},
      winner: 'msg-1',
      consensusLevel: 1,
      isTie: false,
      isUnanimous: true,
      requiresReview: false,
    });

    useAppStore.getState().addVotingHistoryEntry({
      topicId: 'vote-2',
      votes: [],
      totals: {},
      winner: 'msg-2',
      consensusLevel: 0.8,
      isTie: false,
      isUnanimous: false,
      requiresReview: false,
    });

    const history = useAppStore.getState().votingHistory.history;
    expect(history).toHaveLength(2);
    expect(history[0].result.topicId).toBe('vote-2');
    expect(history[1].result.topicId).toBe('vote-1');
  });
});
