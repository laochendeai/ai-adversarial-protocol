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
