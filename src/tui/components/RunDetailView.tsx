import React from 'react';
import { Box, Text } from 'ink';
import { UIRunState } from '@/tui/hooks/useHub';
import { ModelPanel } from './ModelPanel';
import { PhaseIndicator } from './PhaseIndicator';
import { ChallengeView } from './ChallengeView';
import { VoteView } from './VoteView';

interface Props {
  run?: UIRunState;
  width: number;
}

export function RunDetailView({ run, width }: Props) {
  if (!run) {
    return (
      <Box paddingX={1}>
        <Text dimColor>(选择一个 run 查看详情)</Text>
      </Box>
    );
  }

  const modelIds = Object.keys(run.modelOutputs);
  const visibleIds = modelIds.length > 0 ? modelIds : [];

  return (
    <Box flexDirection="column">
      <Box paddingX={1} flexDirection="column">
        <Text bold>📝 {run.question}</Text>
        <Box marginTop={1}>
          <PhaseIndicator phase={run.phase} />
        </Box>
      </Box>
      {visibleIds.length > 0 && (
        <ModelPanel run={run} modelIds={visibleIds} width={width} />
      )}
      <ChallengeView challenges={run.challenges} />
      <VoteView result={run.voting} />
      {run.error && (
        <Box paddingX={1}>
          <Text color="red">错误: {run.error}</Text>
        </Box>
      )}
    </Box>
  );
}
