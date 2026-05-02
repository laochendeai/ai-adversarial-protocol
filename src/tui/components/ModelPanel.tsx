import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { UIRunState } from '@/tui/hooks/useHub';

interface Props {
  run: UIRunState;
  modelIds: string[];
  width: number;
  maxContentRows?: number;
}

function tail(text: string, maxRows: number, colWidth: number): { shown: string; hidden: number } {
  if (!text) return { shown: '', hidden: 0 };
  // Approximate visual rows: split by hard newlines, then estimate wrapping per
  // line. We work backward from the end so the user always sees the freshest
  // tokens; older lines get a "+N hidden" indicator.
  const lines: string[] = [];
  for (const hard of text.split('\n')) {
    if (hard.length <= colWidth) {
      lines.push(hard);
    } else {
      for (let i = 0; i < hard.length; i += colWidth) {
        lines.push(hard.slice(i, i + colWidth));
      }
    }
  }
  if (lines.length <= maxRows) return { shown: text, hidden: 0 };
  const keep = lines.slice(lines.length - maxRows);
  return { shown: keep.join('\n'), hidden: lines.length - keep.length };
}

export function ModelPanel({ run, modelIds, width, maxContentRows = 12 }: Props) {
  const colWidth = Math.max(20, Math.floor((width - 4) / Math.max(1, modelIds.length)) - 1);
  const contentWidth = Math.max(10, colWidth - 2);

  return (
    <Box flexDirection="row" borderStyle="round" borderColor="gray">
      {modelIds.map((id, idx) => {
        const out = run.modelOutputs[id] ?? '';
        const done = run.modelDone[id] ?? false;
        const error = run.modelErrors[id];
        const dur = run.modelDuration[id];
        const tokens = run.modelTokens[id];
        const { shown, hidden } = tail(out, maxContentRows, contentWidth);
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
            {hidden > 0 && (
              <Box>
                <Text dimColor>↑ {hidden} 行已隐藏</Text>
              </Box>
            )}
            <Box marginTop={hidden > 0 ? 0 : 1} flexGrow={1}>
              <Text wrap="wrap">{error ? `ERROR: ${error}` : shown || '(等待输出...)'}</Text>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

