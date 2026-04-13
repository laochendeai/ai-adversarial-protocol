import { describe, it, expect } from 'vitest';
import { calculateVotingResult } from '../calculator';
import { Vote, VotingConfig, AIProvider, AIProviderConfig } from '@/lib/types';

describe('calculateVotingResult - expert-weighted', () => {
  const options = ['A', 'B'];
  const providerConfigs: Record<AIProvider, AIProviderConfig> = {
    claude: { id: 'claude', name: 'Claude', enabled: true, type: 'anthropic', weight: 1.0 },
    openai: { id: 'openai', name: 'OpenAI', enabled: true, type: 'openai', weight: 1.0 },
    gemini: { id: 'gemini', name: 'Gemini', enabled: true, type: 'google', weight: 1.0 },
    local: { id: 'local', name: 'Local', enabled: true, type: 'ollama', weight: 1.0 },
  };

  it('should weight expert provider vote as 3x and make them win over two non-experts', () => {
    const config: VotingConfig = {
      enabled: true,
      mode: 'expert-weighted',
      threshold: 0.5,
      tiebreaker: 'first',
      allowSelfVote: true,
      expertProvider: 'claude',
    };

    const votes: Vote[] = [
      { id: '1', topicId: 't1', voterId: 'claude', choice: 'A', timestamp: Date.now() },
      { id: '2', topicId: 't1', voterId: 'openai', choice: 'B', timestamp: Date.now() },
      { id: '3', topicId: 't1', voterId: 'gemini', choice: 'B', timestamp: Date.now() },
    ];

    const result = calculateVotingResult(votes, options, config, providerConfigs);

    expect(result.winner).toBe('A');
    expect(result.totals['A']).toBe(3);
    expect(result.totals['B']).toBe(2);
  });

  it('should still respect provider weights in addition to expert bonus if applicable', () => {
    const config: VotingConfig = {
      enabled: true,
      mode: 'expert-weighted',
      threshold: 0.5,
      tiebreaker: 'first',
      allowSelfVote: true,
      expertProvider: 'claude',
    };

    const customProviderConfigs: Record<AIProvider, AIProviderConfig> = {
      ...providerConfigs,
      openai: { ...providerConfigs.openai, weight: 4.0 },
    };

    const votes: Vote[] = [
      { id: '1', topicId: 't1', voterId: 'claude', choice: 'A', timestamp: Date.now() },
      { id: '2', topicId: 't1', voterId: 'openai', choice: 'B', timestamp: Date.now() },
    ];

    const result = calculateVotingResult(votes, options, config, customProviderConfigs);

    expect(result.winner).toBe('B');
    expect(result.totals['A']).toBe(3);
    expect(result.totals['B']).toBe(4);
  });

  it('should keep non-expert votes at normal base weights', () => {
    const config: VotingConfig = {
      enabled: true,
      mode: 'expert-weighted',
      threshold: 0.5,
      tiebreaker: 'first',
      allowSelfVote: true,
      expertProvider: 'claude',
    };

    const votes: Vote[] = [
      { id: '1', topicId: 't1', voterId: 'openai', choice: 'A', timestamp: Date.now() },
      { id: '2', topicId: 't1', voterId: 'gemini', choice: 'B', timestamp: Date.now() },
    ];

    const result = calculateVotingResult(votes, options, config, providerConfigs);

    expect(result.totals['A']).toBe(1);
    expect(result.totals['B']).toBe(1);
    expect(result.isTie).toBe(true);
  });
});
