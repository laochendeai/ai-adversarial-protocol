/**
 * AI对抗协议 - 类型定义
 * AI Adversarial Protocol - Type Definitions
 */

// ========== Provider配置 ==========
export interface ProviderConfig {
  type: 'native' | 'custom';  // native=官方API, custom=第三方中转
  apiKey: string;
  baseUrl?: string;  // custom模式下使用
  model?: string;  // 可选模型覆盖
}

// ========== 应用设置 ==========
export interface AppSettings {
  claude: ProviderConfig;
  openai: ProviderConfig;
  sessionBudget?: number;  // 会话预算限制（美元）
}

// ========== 消息和挑战 ==========
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isClaude?: boolean;  // true=Claude, false=OpenAI/Codex, 用户消息无此字段
  timestamp: number;
}

export interface Challenge {
  id: string;
  messageIndex: number;  // 挑战第几条消息
  reason: string;  // 为什么挑刺（用户手动填写）
  timestamp: number;
}

// ========== 对话状态 ==========
export interface DebateState {
  messages: Message[];
  challenges: Challenge[];
  isStreaming: boolean;
  tokenCount: {
    claude: number;
    openai: number;
  };
}

// ========== API请求/响应 ==========
export interface ChatRequest {
  question: string;
  debateState: DebateState;
  provider?: ProviderConfig;  // 可选，用于覆盖.env配置
}

export interface ChatStreamChunk {
  id: string;
  content: string;
  isClaude: boolean;
  done: boolean;
  timestamp: number;
}
