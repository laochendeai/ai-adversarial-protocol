import React from 'react';
import { Box, Text } from 'ink';
import { VotingResult } from '@/lib/types';

interface Props {
  result?: VotingResult;
}

export function VoteView({ result }: Props) {
  if (!result) return null;

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="green" paddingX={1}>
      <Text bold color="green">
        🗳️ 多模型投票
      </Text>
      <Box marginTop={1}>
        {result.winner ? (
          <Text>
            <Text bold color="green">
              获胜:{' '}
            </Text>
            <Text color="cyan" bold>
              {result.winner}
            </Text>
            <Text dimColor> (共识 {(result.consensusLevel * 100).toFixed(1)}%)</Text>
          </Text>
        ) : (
          <Text bold color="yellow">
            平局
          </Text>
        )}
      </Box>
      <Box flexDirection="column" marginTop={1}>
        {Object.entries(result.totals)
          .sort(([, a], [, b]) => b - a)
          .map(([id, score]) => (
            <Text key={id}>
              <Text color="cyan">{id}</Text>: <Text bold>{score.toFixed(2)}</Text> 分
            </Text>
          ))}
      </Box>
      {result.requiresReview && (
        <Box marginTop={1}>
          <Text color="yellow">⚠ 需要人工审查</Text>
        </Box>
      )}
    </Box>
  );
}
