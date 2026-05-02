import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { ModelConfig, ModelProtocol } from '@/lib/types';
import { listOpenAIModels, listOllamaModels } from '@/lib/clients/discovery';

interface Props {
  existingIds: string[];
  onSubmit: (models: ModelConfig[]) => void;
  onCancel: () => void;
}

type Stage =
  | 'base-url'
  | 'protocol'
  | 'api-key'
  | 'discovering'
  | 'pick'
  | 'success'
  | 'error';

const PROTOCOLS: ModelProtocol[] = ['openai', 'anthropic', 'ollama'];

function sanitizeId(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/^-+|-+$/g, '') || 'model';
}

function uniqueId(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

export function DiscoverModal({ existingIds, onSubmit, onCancel }: Props) {
  const [stage, setStage] = useState<Stage>('base-url');
  const [baseUrl, setBaseUrl] = useState('');
  const [protocol, setProtocol] = useState<ModelProtocol>('openai');
  const [protoCursor, setProtoCursor] = useState(0);
  const [apiKey, setApiKey] = useState('');
  const [discovered, setDiscovered] = useState<string[]>([]);
  const [pickCursor, setPickCursor] = useState(0);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [errorMsg, setErrorMsg] = useState('');
  const [lastAdded, setLastAdded] = useState<string[]>([]);
  const [allAddedIds, setAllAddedIds] = useState<string[]>([]);

  const resetForAnotherEndpoint = () => {
    setStage('base-url');
    setBaseUrl('');
    setProtocol('openai');
    setProtoCursor(0);
    setApiKey('');
    setDiscovered([]);
    setPickCursor(0);
    setPicked(new Set());
    setErrorMsg('');
    setLastAdded([]);
  };

  // Discovery effect
  useEffect(() => {
    if (stage !== 'discovering') return;
    let cancelled = false;
    (async () => {
      try {
        let ids: string[];
        if (protocol === 'openai') {
          const list = await listOpenAIModels({ baseUrl, apiKey, timeoutMs: 8000 });
          ids = list.map(m => m.id);
        } else if (protocol === 'ollama') {
          const list = await listOllamaModels({ baseUrl, timeoutMs: 8000 });
          ids = list.map(m => m.id);
        } else {
          // anthropic: 没有 list 接口，走单条手填路径
          if (cancelled) return;
          setErrorMsg(
            'Anthropic 没有公开的 list 接口。请先用 CLI: aap config add <id> --protocol anthropic --base-url ... --api-key ... --model claude-3-...'
          );
          setStage('error');
          return;
        }
        if (cancelled) return;
        if (ids.length === 0) {
          setErrorMsg('endpoint 返回的模型列表为空');
          setStage('error');
          return;
        }
        setDiscovered(ids);
        setStage('pick');
      } catch (err) {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : String(err));
        setStage('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stage, protocol, baseUrl, apiKey]);

  useInput(
    (input, key) => {
      if (key.escape) {
        onCancel();
        return;
      }

      if (stage === 'protocol') {
        if (key.upArrow) setProtoCursor(c => Math.max(0, c - 1));
        else if (key.downArrow) setProtoCursor(c => Math.min(PROTOCOLS.length - 1, c + 1));
        else if (key.return) {
          const p = PROTOCOLS[protoCursor];
          setProtocol(p);
          setStage(p === 'ollama' ? 'discovering' : 'api-key');
        }
        return;
      }

      if (stage === 'pick') {
        if (key.upArrow) setPickCursor(c => Math.max(0, c - 1));
        else if (key.downArrow) setPickCursor(c => Math.min(discovered.length - 1, c + 1));
        else if (key.pageUp) setPickCursor(c => Math.max(0, c - 10));
        else if (key.pageDown) setPickCursor(c => Math.min(discovered.length - 1, c + 10));
        else if (input === ' ') {
          const id = discovered[pickCursor];
          if (id) {
            setPicked(prev => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            });
          }
        } else if (input === 'a' || input === 'A') {
          // toggle all
          setPicked(prev =>
            prev.size === discovered.length ? new Set() : new Set(discovered)
          );
        } else if (key.return) {
          if (picked.size === 0) return;
          const taken = new Set([...existingIds, ...allAddedIds]);
          const models: ModelConfig[] = [...picked].map(upstreamId => {
            const aliasBase = sanitizeId(upstreamId);
            const id = uniqueId(aliasBase, taken);
            taken.add(id);
            return {
              id,
              protocol,
              baseUrl,
              apiKey,
              model: upstreamId,
              weight: 1,
              enabled: true,
            };
          });
          onSubmit(models);
          setLastAdded(models.map(m => m.id));
          setAllAddedIds(prev => [...prev, ...models.map(m => m.id)]);
          setStage('success');
        }
        return;
      }

      if (stage === 'error') {
        if (key.return) onCancel();
        return;
      }

      if (stage === 'success') {
        if (input === 'a' || input === 'A') {
          resetForAnotherEndpoint();
          return;
        }
        if (key.return || key.escape) {
          onCancel();
          return;
        }
      }
    },
    { isActive: true }
  );

  if (stage === 'base-url') {
    return (
      <Box flexDirection="column" borderStyle="double" borderColor="green" paddingX={1}>
        <Text bold>添加模型 — 第 1/3 步：endpoint Base URL (Esc 取消)</Text>
        <Box marginTop={1}>
          <Text>❯ </Text>
          <TextInput
            value={baseUrl}
            onChange={setBaseUrl}
            onSubmit={value => {
              const v = value.trim();
              if (!v) return;
              setBaseUrl(v);
              setStage('protocol');
            }}
            placeholder="http://192.168.0.122:20128/v1"
          />
        </Box>
        <Box marginTop={1}>
          <Text dimColor>OpenAI 兼容代理通常以 /v1 结尾；Ollama 用 http://host:11434（无 /v1）</Text>
        </Box>
      </Box>
    );
  }

  if (stage === 'protocol') {
    return (
      <Box flexDirection="column" borderStyle="double" borderColor="green" paddingX={1}>
        <Text bold>添加模型 — 第 2/3 步：协议 (↑↓ 选择、Enter 确认、Esc 取消)</Text>
        <Box marginTop={1} flexDirection="column">
          {PROTOCOLS.map((p, i) => (
            <Text key={p}>
              {i === protoCursor ? '▶ ' : '  '}
              <Text bold={i === protoCursor}>{p}</Text>
              <Text dimColor>
                {p === 'openai' && '  — OpenAI 兼容（GET /v1/models 自动发现）'}
                {p === 'anthropic' && '  — 无 list 接口，需 CLI 手填'}
                {p === 'ollama' && '  — 本地，无需 API key'}
              </Text>
            </Text>
          ))}
        </Box>
      </Box>
    );
  }

  if (stage === 'api-key') {
    return (
      <Box flexDirection="column" borderStyle="double" borderColor="green" paddingX={1}>
        <Text bold>添加模型 — 第 3/3 步：API Key (Esc 取消)</Text>
        <Box marginTop={1}>
          <Text>❯ </Text>
          <TextInput
            value={apiKey}
            onChange={setApiKey}
            onSubmit={value => {
              const v = value.trim();
              if (!v) return;
              setApiKey(v);
              setStage('discovering');
            }}
            mask="*"
          />
        </Box>
      </Box>
    );
  }

  if (stage === 'discovering') {
    return (
      <Box flexDirection="column" borderStyle="double" borderColor="green" paddingX={1}>
        <Text>正在从 {baseUrl} 拉取模型列表…</Text>
      </Box>
    );
  }

  if (stage === 'pick') {
    const VIEWPORT = 15;
    const start = Math.max(
      0,
      Math.min(discovered.length - VIEWPORT, pickCursor - Math.floor(VIEWPORT / 2))
    );
    const end = Math.min(discovered.length, start + VIEWPORT);
    const visible = discovered.slice(start, end);

    return (
      <Box flexDirection="column" borderStyle="double" borderColor="green" paddingX={1}>
        <Text bold>
          选择要添加的模型 (↑↓ 移动、PgUp/PgDn 翻页、空格切换、A 全选、Enter 确认、Esc 取消)
        </Text>
        <Box marginTop={1} flexDirection="column">
          {start > 0 && <Text dimColor>↑ 上面还有 {start} 个</Text>}
          {visible.map((id, i) => {
            const realIdx = start + i;
            const isCursor = realIdx === pickCursor;
            const isPicked = picked.has(id);
            return (
              <Text key={id}>
                {isCursor ? '▶ ' : '  '}
                <Text color={isPicked ? 'green' : 'gray'}>{isPicked ? '[x]' : '[ ]'}</Text>{' '}
                <Text bold={isCursor}>{id}</Text>
              </Text>
            );
          })}
          {end < discovered.length && (
            <Text dimColor>↓ 下面还有 {discovered.length - end} 个</Text>
          )}
        </Box>
        <Box marginTop={1}>
          <Text dimColor>
            位置 {pickCursor + 1}/{discovered.length} · 已选 {picked.size}
          </Text>
        </Box>
      </Box>
    );
  }

  if (stage === 'success') {
    return (
      <Box flexDirection="column" borderStyle="double" borderColor="green" paddingX={1}>
        <Text bold color="green">
          ✓ 已添加 {lastAdded.length} 个模型
        </Text>
        <Box marginTop={1} flexDirection="column">
          {lastAdded.slice(0, 8).map(id => (
            <Text key={id}>  • {id}</Text>
          ))}
          {lastAdded.length > 8 && (
            <Text dimColor>  …还有 {lastAdded.length - 8} 个</Text>
          )}
        </Box>
        <Box marginTop={1}>
          <Text dimColor>
            本次共添加 {allAddedIds.length} 个 ·{' '}
            <Text color="cyan">[a]</Text> 继续添加另一个 endpoint ·{' '}
            <Text color="cyan">[Enter / Esc]</Text> 完成
          </Text>
        </Box>
      </Box>
    );
  }

  // error
  return (
    <Box flexDirection="column" borderStyle="double" borderColor="red" paddingX={1}>
      <Text bold color="red">发现失败</Text>
      <Box marginTop={1}>
        <Text>{errorMsg}</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>按 Enter 关闭</Text>
      </Box>
    </Box>
  );
}
