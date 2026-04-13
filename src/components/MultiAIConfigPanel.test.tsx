import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MultiAIConfigPanel from './MultiAIConfigPanel';
import type { AIProvider, AIProviderConfig, VotingConfig } from '@/lib/types';

const providers: Record<AIProvider, AIProviderConfig> = {
  claude: { id: 'claude', name: 'Claude', enabled: true, type: 'anthropic', weight: 1 },
  openai: { id: 'openai', name: 'OpenAI', enabled: true, type: 'openai', weight: 1 },
  gemini: { id: 'gemini', name: 'Gemini', enabled: false, type: 'google', weight: 1 },
  local: { id: 'local', name: 'Local AI', enabled: false, type: 'ollama', weight: 0.5 },
};

const baseVotingConfig: VotingConfig = {
  enabled: true,
  mode: 'majority',
  threshold: 0.5,
  tiebreaker: 'first',
  allowSelfVote: false,
  expertProvider: 'claude',
};

describe('MultiAIConfigPanel', () => {
  it('shows expert-weighted mode and reveals expert selector when selected', () => {
    const onProvidersChange = vi.fn();
    const onVotingConfigChange = vi.fn();

    render(
      <MultiAIConfigPanel
        providers={providers}
        votingConfig={{ ...baseVotingConfig, mode: 'expert-weighted' }}
        onProvidersChange={onProvidersChange}
        onVotingConfigChange={onVotingConfigChange}
      />
    );

    fireEvent.click(screen.getByText('▶'));

    expect(screen.getByText('专家加权')).toBeInTheDocument();
    expect(screen.getByText('专家模型')).toBeInTheDocument();
    expect(screen.getByDisplayValue(/Claude/)).toBeInTheDocument();
  });

  it('initializes expert provider when switching to expert-weighted mode', () => {
    const onProvidersChange = vi.fn();
    const onVotingConfigChange = vi.fn();

    render(
      <MultiAIConfigPanel
        providers={providers}
        votingConfig={{ ...baseVotingConfig, expertProvider: undefined, mode: 'majority' }}
        onProvidersChange={onProvidersChange}
        onVotingConfigChange={onVotingConfigChange}
      />
    );

    fireEvent.click(screen.getByText('▶'));
    fireEvent.click(screen.getByText('专家加权'));

    expect(onVotingConfigChange).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'expert-weighted',
        expertProvider: 'claude',
      })
    );
  });

  it('updates expert provider selection', () => {
    const onProvidersChange = vi.fn();
    const onVotingConfigChange = vi.fn();

    render(
      <MultiAIConfigPanel
        providers={providers}
        votingConfig={{ ...baseVotingConfig, mode: 'expert-weighted', expertProvider: 'claude' }}
        onProvidersChange={onProvidersChange}
        onVotingConfigChange={onVotingConfigChange}
      />
    );

    fireEvent.click(screen.getByText('▶'));
    fireEvent.change(screen.getByDisplayValue(/Claude/), { target: { value: 'openai' } });

    expect(onVotingConfigChange).toHaveBeenCalledWith(
      expect.objectContaining({
        expertProvider: 'openai',
      })
    );
  });
});
