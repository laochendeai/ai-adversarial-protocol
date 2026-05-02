/**
 * AdversarialEngine - 单次对抗运行的引擎
 *
 * 一个 run 包含三个阶段：
 *   1. generating  — 并行调用所有模型流式生成答案
 *   2. auto-challenge — 模型互相挑刺（可选）
 *   3. voting       — 模型对结果投票（可选）
 *
 * 通过 EventEmitter 推送事件给订阅者（TUI / SSE）。
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import {
  AdversarialConfig,
  Challenge,
  ChunkEventData,
  EngineEvent,
  EngineEventType,
  Message,
  ModelConfig,
  ModelResponse,
  RunRequest,
  RunResult,
  RunSnapshot,
  Vote,
  VotingResult,
  AuditMetrics,
} from '@/lib/types';
import { streamModel, callModelNonStream } from '@/engine/ModelClient';
import {
  generateAutoChallengePrompt,
  parseChallengeResponse,
  deduplicateChallenges,
  limitChallenges,
} from '@/lib/features/auto-challenge';
import {
  generateVotingPrompt,
  parseVotingResponse,
  calculateVotingResult,
} from '@/lib/features/voting';
import {
  recordMessage,
  recordChallenge,
  getMetrics,
  updateMetrics,
} from '@/lib/features/audit-metrics';

export interface AdversarialEngineOptions {
  request: RunRequest;
  models: ModelConfig[];                 // 已根据 request.modelIds 解析好的模型
  adversarialConfig: AdversarialConfig;
  storageDir: string;
  signal?: AbortSignal;
}

export class AdversarialEngine extends EventEmitter {
  readonly runId: string;
  readonly snapshot: RunSnapshot;
  private readonly modelMap: Map<string, ModelConfig>;
  private readonly options: AdversarialEngineOptions;

  constructor(options: AdversarialEngineOptions) {
    super();
    this.runId = randomUUID();
    this.options = options;
    this.modelMap = new Map(options.models.map(m => [m.id, m]));
    this.snapshot = {
      runId: this.runId,
      source: options.request.source,
      request: options.request,
      phase: 'pending',
      responses: {},
      challenges: [],
      startedAt: Date.now(),
    };
  }

  private emitEvent(type: EngineEventType, data: unknown) {
    const event: EngineEvent = {
      runId: this.runId,
      type,
      timestamp: Date.now(),
      data,
    };
    this.emit('event', event);
    this.emit(type, data);
  }

  async run(): Promise<RunResult> {
    const start = Date.now();
    const maxRounds = Math.max(
      1,
      this.options.request.maxRounds ?? this.options.adversarialConfig.maxRounds ?? 1
    );
    this.snapshot.totalRounds = maxRounds;

    try {
      this.snapshot.phase = 'pending';
      this.emitEvent('run-start', { request: this.options.request, models: this.options.models });

      let responses: ModelResponse[] = [];
      let challenges: Challenge[] = [];
      const enableAC =
        this.options.request.enableAutoChallenge ??
        this.options.adversarialConfig.autoChallenge.enabled;

      for (let round = 1; round <= maxRounds; round++) {
        this.snapshot.currentRound = round;
        this.emitEvent('round-start', { round, totalRounds: maxRounds });

        // ==== Phase: Generating ====
        this.snapshot.phase = 'generating';
        this.emitEvent('phase-change', { phase: 'generating' });

        const prior = round > 1 ? { responses, challenges } : undefined;
        responses = await this.runGenerating(prior);
        // Snapshot reflects the latest round only.
        this.snapshot.responses = {};
        responses.forEach(r => {
          this.snapshot.responses[r.modelId] = r;
        });

        // ==== Phase: Auto-Challenge ====
        // Run challenges every round so round n+1 can refine off them.
        // On the final round we still record them so the UI can show them.
        if (enableAC && responses.filter(r => !r.error).length >= 2) {
          this.snapshot.phase = 'auto-challenge';
          this.emitEvent('phase-change', { phase: 'auto-challenge' });
          challenges = await this.runAutoChallenge(responses);
          this.snapshot.challenges = challenges;
        } else {
          challenges = [];
          this.snapshot.challenges = [];
        }
      }

      // ==== Phase: Voting (only on final round responses) ====
      const enableV =
        this.options.request.enableVoting ??
        this.options.adversarialConfig.voting.enabled;
      let voting: VotingResult | undefined;
      if (enableV && responses.filter(r => !r.error).length >= 2) {
        this.snapshot.phase = 'voting';
        this.emitEvent('phase-change', { phase: 'voting' });
        voting = await this.runVoting(responses);
        this.snapshot.voting = voting;
      }

      // ==== Audit Metrics ====
      const metrics = this.computeAuditMetrics(responses, this.snapshot.challenges);

      this.snapshot.phase = 'complete';
      this.snapshot.finishedAt = Date.now();
      this.emitEvent('phase-change', { phase: 'complete' });

      const result: RunResult = {
        runId: this.runId,
        responses,
        challenges: this.snapshot.challenges,
        voting,
        metrics,
        durationMs: Date.now() - start,
      };
      this.emitEvent('run-complete', { result });

      this.flushAuditMetrics(metrics).catch(err => {
        // eslint-disable-next-line no-console
        console.warn(`[run ${this.runId}] audit metrics flush failed:`, err);
      });

      return result;
    } catch (err) {
      this.snapshot.phase = 'failed';
      this.snapshot.finishedAt = Date.now();
      this.snapshot.error = err instanceof Error ? err.message : String(err);
      this.emitEvent('run-failed', { error: this.snapshot.error });
      throw err;
    }
  }

  private buildRefinementMessage(
    prevResponses: ModelResponse[],
    prevChallenges: Challenge[]
  ): string {
    const parts: string[] = ['【上一轮各模型给出的回答】'];
    for (const r of prevResponses) {
      const model = this.modelMap.get(r.modelId);
      const display = model?.id ?? r.modelId;
      const body = r.error ? `(本轮失败: ${r.error})` : r.content;
      parts.push(`\n— 模型 ${display} —\n${body}`);
    }
    if (prevChallenges.length > 0) {
      parts.push('\n\n【上一轮模型间的相互挑刺】');
      for (const c of prevChallenges) {
        parts.push(
          `- ${c.challengerId} → ${c.targetId} [${c.type}/${c.severity}]: ${c.reason}`
        );
      }
    }
    parts.push(
      '\n请基于以上信息修正和完善你对原问题的回答。如果之前有错误或遗漏，请直接更正；' +
        '如果你认为之前回答仍然成立，可以重申并补充论据。直接给出新的完整回答，不要用 "我同意" 之类的元评论开头。'
    );
    return parts.join('\n');
  }

  private async runGenerating(
    prior?: { responses: ModelResponse[]; challenges: Challenge[] }
  ): Promise<ModelResponse[]> {
    const { request, models, signal } = this.options;
    const baseMessages: Message[] = [
      ...(request.history ?? []),
      { role: 'user', content: request.question },
    ];
    const messages: Message[] = prior
      ? [
          ...baseMessages,
          {
            role: 'user',
            content: this.buildRefinementMessage(prior.responses, prior.challenges),
          },
        ]
      : baseMessages;

    return Promise.all(
      models.map(async model => {
        let contentSoFar = '';
        const response = await streamModel({
          model,
          messages,
          signal,
          onDelta: delta => {
            contentSoFar += delta;
            const data: ChunkEventData = {
              modelId: model.id,
              delta,
              contentSoFar,
            };
            this.emitEvent('chunk', data);
          },
        });
        this.emitEvent('model-complete', { response });
        return response;
      })
    );
  }

  private async runAutoChallenge(responses: ModelResponse[]): Promise<Challenge[]> {
    const succeeded = responses.filter(r => !r.error && r.content);
    if (succeeded.length < 2) return [];

    const maxPerRound = this.options.adversarialConfig.autoChallenge.maxChallengesPerRound;

    // 每个模型 → 审计其他每个模型
    const tasks: Promise<Challenge[]>[] = [];
    for (const challenger of succeeded) {
      const challengerModel = this.modelMap.get(challenger.modelId);
      if (!challengerModel) continue;
      for (const target of succeeded) {
        if (target.modelId === challenger.modelId) continue;
        tasks.push(
          this.singleChallenge(challengerModel, challenger.modelId, target).catch(err => {
            // eslint-disable-next-line no-console
            console.warn(
              `[run ${this.runId}] challenge ${challenger.modelId} → ${target.modelId} failed:`,
              err instanceof Error ? err.message : err
            );
            return [] as Challenge[];
          })
        );
      }
    }

    const all = (await Promise.all(tasks)).flat();
    const dedup = deduplicateChallenges(all);
    const limited = limitChallenges(dedup, maxPerRound * succeeded.length);
    limited.forEach(c => this.emitEvent('challenge', { challenge: c }));
    return limited;
  }

  private async singleChallenge(
    challengerModel: ModelConfig,
    challengerId: string,
    target: ModelResponse
  ): Promise<Challenge[]> {
    const targetModel = this.modelMap.get(target.modelId);
    const targetDisplay = targetModel?.id ?? target.modelId;
    const prompt = generateAutoChallengePrompt({
      targetContent: target.content,
      targetDisplayName: targetDisplay,
    });

    const messages: Message[] = [{ role: 'user', content: prompt }];
    const result = await callModelNonStream(challengerModel, messages, {
      signal: this.options.signal,
      maxTokens: 2048,
    });

    const parsed = parseChallengeResponse(result.content, {
      challengerId,
      targetId: target.modelId,
      threshold: this.options.adversarialConfig.autoChallenge.threshold,
    });
    if (parsed.error) {
      // eslint-disable-next-line no-console
      console.warn(
        `[run ${this.runId}] challenge response from ${challengerId} unparseable:`,
        parsed.error
      );
    }
    return parsed.challenges;
  }

  private async runVoting(responses: ModelResponse[]): Promise<VotingResult> {
    const succeeded = responses.filter(r => !r.error && r.content);
    const candidateIds = succeeded.map(r => r.modelId);
    if (candidateIds.length < 2) {
      return {
        votes: [],
        totals: {},
        consensusLevel: 0,
        isTie: false,
        isUnanimous: false,
        requiresReview: true,
      };
    }

    const prompt = generateVotingPrompt({
      question: this.options.request.question,
      candidates: succeeded,
      candidateModels: this.modelMap,
    });

    const tasks = succeeded.map(async r => {
      const voterModel = this.modelMap.get(r.modelId);
      if (!voterModel) return null;
      try {
        const result = await callModelNonStream(
          voterModel,
          [{ role: 'user', content: prompt }],
          { signal: this.options.signal, maxTokens: 1024 }
        );
        const parsed = parseVotingResponse(result.content, candidateIds);
        if (!parsed) {
          // eslint-disable-next-line no-console
          console.warn(
            `[run ${this.runId}] vote response from ${r.modelId} unparseable`
          );
          return null;
        }
        const vote: Vote = {
          voterId: r.modelId,
          choice: parsed.choice,
          confidence: parsed.confidence,
          reasoning: parsed.reasoning,
          timestamp: Date.now(),
        };
        return vote;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(
          `[run ${this.runId}] vote call from ${r.modelId} failed:`,
          err instanceof Error ? err.message : err
        );
        return null;
      }
    });

    const votes = (await Promise.all(tasks)).filter((v): v is Vote => v !== null);
    const result = calculateVotingResult({
      votes,
      options: candidateIds,
      models: this.modelMap,
      config: this.options.adversarialConfig.voting,
    });
    this.emitEvent('voting-result', { result });
    return result;
  }

  private computeAuditMetrics(
    responses: ModelResponse[],
    challenges: Challenge[]
  ): Record<string, AuditMetrics> {
    const result: Record<string, AuditMetrics> = {};
    for (const r of responses) {
      if (r.error) continue;
      let m = getMetrics(r.modelId, this.options.storageDir);
      m = recordMessage(m);
      const targeting = challenges.filter(c => c.targetId === r.modelId);
      for (const c of targeting) m = recordChallenge(m, c);
      result[r.modelId] = m;
    }
    return result;
  }

  private async flushAuditMetrics(
    metrics: Record<string, AuditMetrics>
  ): Promise<void> {
    const writes = Object.entries(metrics).map(([modelId, m]) =>
      updateMetrics(modelId, m, this.options.storageDir)
    );
    await Promise.all(writes);
  }
}
