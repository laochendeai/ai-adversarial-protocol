import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { UIRunState } from '@/tui/hooks/useHub';

interface Props {
  run: UIRunState;
  modelIds: string[];
  width: number;
}

const MAX_CHARS = 800;

function truncate(s: string): string {
  if (s.length <= MAX_CHARS) return s;
  return '...' + s.slice(-MAX_CHARS);
}

export function ModelPanel({ run, modelIds, width }: Props) {
  const colWidth = Math.max(20, Math.floor((width - 4) / Math.max(1, modelIds.length)) - 1);

  return (
    <Box flexDirection="row" borderStyle="round" borderColor="gray">
      {modelIds.map((id, idx) => {
        const out = run.modelOutputs[id] ?? '';
        const done = run.modelDone[id] ?? false;
        const error = run.modelErrors[id];
        const dur = run.modelDuration[id];
        const tokens = run.modelTokens[id];
        return (
          <Box
            key={id}
            flexDirection="column"
            width={colWidth}
            paddingX={1}
            borderStyle={idx === 0 ? undefined : 'single'}
            borderLeft={idx > 0}
            borderTop={false}
            borderBottom={false}
            borderRight={false}
            borderColor="gray"
          >
            <Box>
              <Text bold color="cyan">
                {id}
              </Text>
              {!done && (
                <Text color="yellow">
                  {' '}
                  <Spinner type="dots" />
                </Text>
              )}
              {done && !error && <Text color="green"> ✓</Text>}
              {error && <Text color="red"> ✗</Text>}
            </Box>
            <Box>
              <Text dimColor>
                {dur ? `${dur}ms` : '...'} | {tokens ?? 0} tk
              </Text>
            </Box>
            <Box marginTop={1} flexGrow={1}>
              <Text wrap="wrap">{error ? `ERROR: ${error}` : truncate(out) || '(等待输出...)'}</Text>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
