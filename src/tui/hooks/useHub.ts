/**
 * useHub - 订阅 EngineHub 事件，维护当前所有 run 的 React 状态
 */

import { useEffect, useState } from 'react';
import {
  ChunkEventData,
  EngineEvent,
  RunCompleteEventData,
  RunFailedEventData,
  RunSnapshot,
  RunPhase,
  Challenge,
  VotingResult,
  ModelResponse,
  PhaseChangeEventData,
} from '@/lib/types';
import { EngineHub } from '@/engine/EngineHub';

export interface UIRunState {
  runId: string;
  source: RunSnapshot['source'];
  phase: RunPhase;
  question: string;
  modelOutputs: Record<string, string>;
  modelDone: Record<string, boolean>;
  modelDuration: Record<string, number>;
  modelTokens: Record<string, number>;
  modelErrors: Record<string, string>;
  challenges: Challenge[];
  voting?: VotingResult;
  startedAt: number;
  finishedAt?: number;
  error?: string;
}

function emptyRunState(snapshot: RunSnapshot): UIRunState {
  return {
    runId: snapshot.runId,
    source: snapshot.source,
    phase: snapshot.phase,
    question: snapshot.request.question,
    modelOutputs: {},
    modelDone: {},
    modelDuration: {},
    modelTokens: {},
    modelErrors: {},
    challenges: [],
    startedAt: snapshot.startedAt,
  };
}

export function useHub(hub: EngineHub) {
  const [runs, setRuns] = useState<Record<string, UIRunState>>({});
  const [order, setOrder] = useState<string[]>([]);

  useEffect(() => {
    const handler = (event: EngineEvent) => {
      setRuns(prev => {
        const existing = prev[event.runId];

        if (event.type === 'run-start') {
          const snapshot = hub.getRun(event.runId);
          if (!snapshot) return prev;
          const fresh = emptyRunState(snapshot);
          fresh.phase = 'generating';
          setOrder(o => (o.includes(event.runId) ? o : [event.runId, ...o].slice(0, 20)));
          return { ...prev, [event.runId]: fresh };
        }

        if (!existing) return prev;
        const next = { ...existing };

        if (event.type === 'phase-change') {
          next.phase = (event.data as PhaseChangeEventData).phase;
        } else if (event.type === 'chunk') {
          const data = event.data as ChunkEventData;
          next.modelOutputs = {
            ...next.modelOutputs,
            [data.modelId]: (next.modelOutputs[data.modelId] ?? '') + data.delta,
          };
        } else if (event.type === 'model-complete') {
          const { response } = event.data as { response: ModelResponse };
          next.modelDone = { ...next.modelDone, [response.modelId]: true };
          next.modelDuration = { ...next.modelDuration, [response.modelId]: response.durationMs };
          next.modelTokens = {
            ...next.modelTokens,
            [response.modelId]: response.tokensIn + response.tokensOut,
          };
          if (response.error) {
            next.modelErrors = { ...next.modelErrors, [response.modelId]: response.error };
          }
        } else if (event.type === 'challenge') {
          const { challenge } = event.data as { challenge: Challenge };
          next.challenges = [...next.challenges, challenge];
        } else if (event.type === 'voting-result') {
          next.voting = (event.data as { result: VotingResult }).result;
        } else if (event.type === 'run-complete') {
          const { result } = event.data as RunCompleteEventData;
          next.phase = 'complete';
          next.finishedAt = Date.now();
          next.voting = result.voting ?? next.voting;
        } else if (event.type === 'run-failed') {
          next.phase = 'failed';
          next.finishedAt = Date.now();
          next.error = (event.data as RunFailedEventData).error;
        }

        return { ...prev, [event.runId]: next };
      });
    };

    hub.on('engine-event', handler);
    return () => {
      hub.off('engine-event', handler);
    };
  }, [hub]);

  return { runs, order };
}
