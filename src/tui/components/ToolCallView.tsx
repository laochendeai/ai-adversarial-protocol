import React from 'react';
import { Box, Text } from 'ink';
import { UIToolCall, UIWithdrawal } from '@/tui/hooks/useHub';

interface Props {
  toolCalls: UIToolCall[];
  withdrawals: UIWithdrawal[];
}

const TOOL_COLOR: Record<string, 'cyan' | 'magenta' | 'yellow' | 'green' | 'blue'> = {
  search: 'cyan',
  fetch_url: 'blue',
  exec_python: 'yellow',
  concede: 'magenta',
};

function shortPreview(s: string, max = 80): string {
  const oneLine = s.replace(/\s+/g, ' ').trim();
  return oneLine.length > max ? oneLine.slice(0, max) + '…' : oneLine;
}

export function ToolCallView({ toolCalls, withdrawals }: Props) {
  if (toolCalls.length === 0 && withdrawals.length === 0) return null;

  // Group by modelId so the user can see "did model X call any tools at all?"
  const byModel = new Map<string, UIToolCall[]>();
  for (const tc of toolCalls) {
    const list = byModel.get(tc.modelId) ?? [];
    list.push(tc);
    byModel.set(tc.modelId, list);
  }

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="cyan" paddingX={1}>
      <Text bold color="cyan">
        🛠 工具调用 ({toolCalls.length})
        {toolCalls.length === 0 && (
          <Text color="red"> · 无 — 模型未使用任何工具</Text>
        )}
      </Text>
      {[...byModel.entries()].map(([modelId, calls]) => (
        <Box key={modelId} flexDirection="column" marginTop={1}>
          <Text>
            <Text bold color="white">{modelId}</Text>
            <Text dimColor> ({calls.length})</Text>
          </Text>
          {calls.slice(0, 6).map((tc, i) => {
            const color = TOOL_COLOR[tc.toolName] ?? 'green';
            return (
              <Box key={`${modelId}-${i}`} marginLeft={2}>
                <Text>
                  <Text color={tc.ok ? 'green' : 'red'}>{tc.ok ? '✓' : '✗'}</Text>{' '}
                  <Text color={color} bold>{tc.toolName}</Text>
                  <Text dimColor>: {shortPreview(tc.preview)}</Text>
                </Text>
              </Box>
            );
          })}
          {calls.length > 6 && (
            <Text dimColor>     ...还有 {calls.length - 6} 次调用</Text>
          )}
        </Box>
      ))}
      {withdrawals.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color="magenta">主动认错退出 ({withdrawals.length})</Text>
          {withdrawals.map(w => (
            <Box key={w.modelId} marginLeft={2}>
              <Text>
                <Text color="magenta">⚐</Text>{' '}
                <Text bold>{w.modelId}</Text>
                {w.deferTo && <Text dimColor> → defers to {w.deferTo}</Text>}
              </Text>
              <Text dimColor>     {shortPreview(w.reason, 100)}</Text>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
