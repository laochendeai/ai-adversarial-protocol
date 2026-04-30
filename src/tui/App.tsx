import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput, useStdout } from 'ink';
import { EngineHub } from '@/engine/EngineHub';
import { useHub } from '@/tui/hooks/useHub';
import { RunListPanel } from '@/tui/components/RunListPanel';
import { RunDetailView } from '@/tui/components/RunDetailView';
import { InputModal } from '@/tui/components/InputModal';

interface Props {
  hub: EngineHub;
  serverUrl?: string;
}

export function App({ hub, serverUrl }: Props) {
  const { runs, order } = useHub(hub);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [showInput, setShowInput] = useState(false);
  const { exit } = useApp();
  const { stdout } = useStdout();

  const config = hub.getConfig();
  const cols = stdout?.columns ?? 100;

  const selectedId = order[selectedIdx] ?? order[0];
  const selectedRun = selectedId ? runs[selectedId] : undefined;

  // Re-clamp selectedIdx when the run list shrinks (e.g. once we add "clear
  // history"), so the cursor never points past the end.
  useEffect(() => {
    setSelectedIdx(i => Math.min(i, Math.max(0, order.length - 1)));
  }, [order.length]);

  useInput((input, key) => {
    if (showInput) return;

    if (input === 'q' || (key.ctrl && input === 'c')) {
      exit();
      return;
    }
    if (input === 'n') {
      setShowInput(true);
      return;
    }
    if (key.upArrow) {
      setSelectedIdx(i => Math.max(0, i - 1));
    } else if (key.downArrow) {
      setSelectedIdx(i => Math.min(Math.max(0, order.length - 1), i + 1));
    }
  });

  const handleSubmit = (question: string, modelIds: string[]) => {
    setShowInput(false);
    try {
      hub.startRun({
        question,
        modelIds,
        source: 'tui-input',
      });
    } catch (err) {
      // 错误会在 run 列表中显示
    }
  };

  const totalRuns = order.length;
  const activeCount = Object.values(runs).filter(
    r => r.phase !== 'complete' && r.phase !== 'failed'
  ).length;

  return (
    <Box flexDirection="column">
      <Box borderStyle="round" borderColor="cyan" paddingX={1}>
        <Text bold color="cyan">
          🥊 AI 对抗协议
        </Text>
        <Text dimColor>{'  '}</Text>
        {serverUrl && (
          <Text>
            <Text color="green">●</Text> Server: {serverUrl}
          </Text>
        )}
        <Text dimColor>
          {'  '}活跃: {activeCount} / 总: {totalRuns}
        </Text>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text bold>📋 运行列表</Text>
        <RunListPanel runs={runs} order={order} selectedRunId={selectedId} />
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text bold>🔬 详情</Text>
        <RunDetailView run={selectedRun} width={cols} />
      </Box>

      <Box marginTop={1} paddingX={1}>
        <Text dimColor>
          [↑↓] 切换 run · [n] 新问题 · [q] 退出
        </Text>
      </Box>

      {showInput && (
        <Box marginTop={1}>
          <InputModal
            models={config.models}
            onSubmit={handleSubmit}
            onCancel={() => setShowInput(false)}
          />
        </Box>
      )}
    </Box>
  );
}
