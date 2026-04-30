/**
 * AI对抗协议 - 类型定义（重构后）
 * AI Adversarial Protocol - Type Definitions
 */

// ========== 模型配置 ==========

export type ModelProtocol = 'openai' | 'anthropic' | 'ollama';

/**
 * 单个模型的配置。一个 endpoint 可以提供多个模型，
 * 每个模型一条 ModelConfig 记录。
 */
export interface ModelConfig {
  id: string;              // 用户指定的别名，全局唯一
  protocol: ModelProtocol;
  baseUrl: string;
  apiKey: string;
  model: string;           // 上游真实模型名
  weight?: number;         // 投票权重，默认 1.0
  enabled: boolean;
}

// ========== 应用配置 ==========

export interface AdversarialConfig {
  autoChallenge: {
    enabled: boolean;
    threshold: number;       // 置信度阈值（0-1）
    maxChallengesPerRound: number;
  };
  voting: {
    enabled: boolean;
    mode: 'majority' | 'weighted' | 'consensus' | 'unanimous';
    threshold: number;
    tiebreaker: 'first' | 'random' | 'abstain';
  };
}

export interface ServerConfig {
  port: number;
  host: string;
}

export interface AppConfig {
  models: ModelConfig[];
  server: ServerConfig;
  adversarial: AdversarialConfig;
  storageDir: string;        // 默认 ~/.aap
}

// ========== 消息（最小化，无UI字段）==========

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// ========== 单个模型的回答 ==========

export interface ModelResponse {
  modelId: string;             // ModelConfig.id
  content: string;
  tokensIn: number;
  tokensOut: number;
  durationMs: number;
  error?: string;
  thinkingBlocks?: ThinkingBlock[];
}

// ========== 思维过程 ==========

export interface ThinkingBlock {
  modelId: string;
  content: string;
  order: number;
  source: 'explicit-tag' | 'extended-thinking' | 'o1-reasoning';
}

// ========== 互相挑刺 ==========

export type ChallengeType =
  | 'factual-error'
  | 'logical-flaw'
  | 'omission'
  | 'unclear'
  | 'other';

export type ChallengeSeverity = 'low' | 'medium' | 'high';
export type ChallengeStatus = 'pending' | 'accepted' | 'rejected' | 'debated';

export interface Challenge {
  id: string;
  challengerId: string;        // 发起挑刺的 ModelConfig.id
  targetId: string;            // 被挑刺的 ModelConfig.id
  type: ChallengeType;
  severity: ChallengeSeverity;
  targetSegment: string;       // 被挑刺的具体文本片段
  reason: string;              // 挑刺原因
  confidence: number;          // 0-1
  status: ChallengeStatus;
  timestamp: number;
}

// ========== 投票 ==========

export interface Vote {
  voterId: string;             // 投票模型 ModelConfig.id
  choice: string;              // 选择的 modelId
  confidence: number;
  reasoning?: string;
  timestamp: number;
}

export interface VotingResult {
  votes: Vote[];
  totals: Record<string, number>;     // modelId → 加权总分
  winner?: string;                    // modelId
  consensusLevel: number;             // 0-1
  isTie: boolean;
  isUnanimous: boolean;
  requiresReview: boolean;
}

// ========== 审计评分 ==========

export interface AuditMetrics {
  modelId: string;
  totalMessages: number;
  totalChallenges: number;
  challengesByType: Record<ChallengeType, number>;
  challengesBySeverity: Record<ChallengeSeverity, number>;
  acceptedChallenges: number;
  rejectedChallenges: number;
  reliabilityScore: number;     // 0-100，-1 = 数据不足
  lastUpdated: number;
}

export interface AuditState {
  metrics: Record<string, AuditMetrics>;
}

// ========== 对抗运行 ==========

export type RunSource = 'tui-input' | 'http-openai' | 'http-anthropic';

export type RunPhase =
  | 'pending'
  | 'generating'
  | 'auto-challenge'
  | 'voting'
  | 'complete'
  | 'failed';

export interface RunRequest {
  question: string;
  history?: Message[];           // 之前的对话历史
  modelIds: string[];            // 参与的模型 ID
  source: RunSource;
  enableAutoChallenge?: boolean; // 覆盖默认配置
  enableVoting?: boolean;
}

export interface RunSnapshot {
  runId: string;
  source: RunSource;
  request: RunRequest;
  phase: RunPhase;
  responses: Record<string, ModelResponse>;  // modelId → response
  challenges: Challenge[];
  voting?: VotingResult;
  startedAt: number;
  finishedAt?: number;
  error?: string;
}

export interface RunResult {
  runId: string;
  responses: ModelResponse[];
  challenges: Challenge[];
  voting?: VotingResult;
  metrics: Record<string, AuditMetrics>;
  durationMs: number;
}

// ========== Engine 事件 ==========

export type EngineEventType =
  | 'run-start'
  | 'phase-change'
  | 'chunk'
  | 'model-complete'
  | 'challenge'
  | 'voting-result'
  | 'run-complete'
  | 'run-failed';

export interface EngineEvent {
  runId: string;
  type: EngineEventType;
  timestamp: number;
  data: unknown;
}

export interface ChunkEventData {
  modelId: string;
  delta: string;
  contentSoFar: string;
}

export interface PhaseChangeEventData {
  phase: RunPhase;
}

export interface ModelCompleteEventData {
  response: ModelResponse;
}

export interface ChallengeEventData {
  challenge: Challenge;
}

export interface VoteEventData {
  vote: Vote;
}

export interface VotingResultEventData {
  result: VotingResult;
}

export interface RunCompleteEventData {
  result: RunResult;
}

export interface RunFailedEventData {
  error: string;
}
