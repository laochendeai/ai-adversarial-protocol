/**
 * Zustand Store - 状态管理
 * 处理DebateState、AppSettings、错误状态等
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DebateState, Message, Challenge, AppSettings, ProviderConfig, AuditState, AuditMetrics, SerialReferenceConfig, AutoChallengeConfig, AIProvider, AIProviderConfig, VotingConfig, VotingResult } from './types';
import { getClientConfig, saveSettings, DEFAULT_SETTINGS } from './config';
import { saveConversation, clearConversation as clearConv } from './conversation-store';
import { getMetrics, updateMetrics, recordMessage, recordChallenge, recordChallengeOutcome, createInitialMetrics } from './features/audit-metrics';

interface AppState {
  // Debate状态
  debateState: DebateState;

  // 更新debate状态
  addMessage: (message: Message) => void;
  updateMessage: (messageId: string, content: string) => void;
  addChallenge: (challenge: Challenge) => void;
  updateChallengeStatus: (challengeId: string, status: 'accepted' | 'rejected' | 'debated') => void;
  clearMessages: () => void;
  setStreaming: (isStreaming: boolean) => void;
  updateTokenCount: (claude: number, openai: number) => void;

  // 配置
  settings: AppSettings;
  updateSettings: (settings: AppSettings) => void;
  resetSettings: () => void;

  // 错误状态
  errors: {
    claude: string | null;
    openai: string | null;
  };
  setClaudeError: (error: string | null) => void;
  setOpenAIError: (error: string | null) => void;
  clearErrors: () => void;

  // UI状态
  isSettingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;

  // 审计质量评分 (Phase 2 - Feature 5)
  auditState: AuditState;
  loadAuditState: () => void;
  updateAuditMetrics: (aiId: 'claude' | 'openai', action: 'message' | 'challenge' | 'outcome', data?: any) => void;
  clearAuditData: () => void;

  // 串行引用配置 (Phase 2 - Feature 1)
  serialConfig: SerialReferenceConfig;
  updateSerialConfig: (config: SerialReferenceConfig) => void;

  // 自动挑刺配置 (Phase 2 - Feature 2)
  autoChallengeConfig: AutoChallengeConfig;
  updateAutoChallengeConfig: (config: AutoChallengeConfig) => void;

  // 多AI投票配置 (Phase 2 - Feature 4)
  aiProviders: Record<AIProvider, AIProviderConfig>;
  votingConfig: VotingConfig;
  votingResult?: VotingResult;
  updateAIProviders: (providers: Record<AIProvider, AIProviderConfig>) => void;
  updateVotingConfig: (config: VotingConfig) => void;
  setVotingResult: (result: VotingResult | undefined) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // 初始Debate状态
      debateState: {
        messages: [],
        challenges: [],
        isStreaming: false,
        tokenCount: {
          claude: 0,
          openai: 0,
        },
      },

      // 初始审计状态
      auditState: {
        metrics: {},
        history: [],
      },

      // 初始串行配置 (Phase 2 - Feature 1)
      serialConfig: {
        enabled: false,
        mode: 'always-serial',
        firstResponder: 'auto',
      },

      // 初始自动挑刺配置 (Phase 2 - Feature 2)
      autoChallengeConfig: {
        enabled: false,
        threshold: 0.7,
        maxChallengesPerRound: 3,
        allowSelfChallenge: false,
      },

      // 初始AI Providers配置 (Phase 2 - Feature 4)
      aiProviders: {
        claude: {
          id: 'claude',
          name: 'Claude',
          enabled: true,
          type: 'anthropic',
          weight: 1.0,
        },
        openai: {
          id: 'openai',
          name: 'OpenAI',
          enabled: true,
          type: 'openai',
          weight: 1.0,
        },
        gemini: {
          id: 'gemini',
          name: 'Gemini',
          enabled: false,
          type: 'google',
          weight: 1.0,
        },
        local: {
          id: 'local',
          name: 'Local AI',
          enabled: false,
          type: 'ollama',
          weight: 0.5,
        },
      },

      // 初始投票配置 (Phase 2 - Feature 4)
      votingConfig: {
        enabled: false,
        mode: 'majority',
        threshold: 0.5,
        tiebreaker: 'first',
        allowSelfVote: false,
        expertProvider: 'claude',
      },

      votingResult: undefined,

      // Debate状态操作
      addMessage: (message) =>
        set((state) => {
          const newState = {
            ...state.debateState,
            messages: [...state.debateState.messages, message],
          };
          // 自动保存到LocalStorage
          saveConversation(newState);

          // 自动记录到审计系统 (Phase 2 - Feature 5)
          if (message.role === 'assistant' && message.isClaude !== undefined) {
            const aiId = message.isClaude ? 'claude' : 'openai';
            const metrics = state.auditState.metrics[aiId] || createInitialMetrics(aiId);
            const updatedMetrics = recordMessage(metrics);
            updateMetrics(aiId, updatedMetrics);

            return {
              debateState: newState,
              auditState: {
                ...state.auditState,
                metrics: {
                  ...state.auditState.metrics,
                  [aiId]: updatedMetrics,
                },
              },
            };
          }

          return { debateState: newState };
        }),

      updateMessage: (messageId, content) =>
        set((state) => {
          const messages = state.debateState.messages.map(msg =>
            msg.id === messageId ? { ...msg, content } : msg
          );
          const newState = {
            ...state.debateState,
            messages,
          };
          // 自动保存到LocalStorage
          saveConversation(newState);
          return { debateState: newState };
        }),

      addChallenge: (challenge) =>
        set((state) => {
          const newState = {
            ...state.debateState,
            challenges: [...state.debateState.challenges, challenge],
          };
          // 自动保存到LocalStorage
          saveConversation(newState);
          return { debateState: newState };
        }),

      updateChallengeStatus: (challengeId, status) =>
        set((state) => {
          const challenges = state.debateState.challenges.map((challenge) =>
            challenge.id === challengeId ? { ...challenge, status } : challenge
          );
          const newState = {
            ...state.debateState,
            challenges,
          };
          saveConversation(newState);
          return { debateState: newState };
        }),

      clearMessages: () =>
        set((state) => {
          const newState = {
            ...state.debateState,
            messages: [],
            challenges: [],
            tokenCount: { claude: 0, openai: 0 },
          };
          // 清除LocalStorage
          clearConv();
          return { debateState: newState };
        }),

      setStreaming: (isStreaming) =>
        set((state) => ({
          debateState: {
            ...state.debateState,
            isStreaming,
          },
        })),

      updateTokenCount: (claude, openai) =>
        set((state) => ({
          debateState: {
            ...state.debateState,
            tokenCount: {
              claude: state.debateState.tokenCount.claude + claude,
              openai: state.debateState.tokenCount.openai + openai,
            },
          },
        })),

      // 配置操作
      settings: getClientConfig(),

      updateSettings: (newSettings) =>
        set((state) => {
          saveSettings(newSettings);
          return { settings: newSettings };
        }),

      resetSettings: () =>
        set((state) => {
          const defaultConfig = DEFAULT_SETTINGS;
          // 从localStorage清除
          if (typeof window !== 'undefined') {
            localStorage.removeItem('ai-adversarial-settings');
          }
          return { settings: defaultConfig };
        }),

      // 错误状态操作
      errors: {
        claude: null,
        openai: null,
      },

      setClaudeError: (error) =>
        set((state) => ({
          errors: { ...state.errors, claude: error },
        })),

      setOpenAIError: (error) =>
        set((state) => ({
          errors: { ...state.errors, openai: error },
        })),

      clearErrors: () =>
        set(() => ({
          errors: { claude: null, openai: null },
        })),

      // UI状态操作
      isSettingsOpen: false,

      openSettings: () => set({ isSettingsOpen: true }),

      closeSettings: () => set({ isSettingsOpen: false }),

      // 审计质量评分操作
      loadAuditState: () => {
        const { loadAuditState: loadState } = require('./features/audit-metrics');
        const auditState = loadState();
        set({ auditState });
      },

      updateAuditMetrics: (aiId, action, data) => {
        set((state) => {
          const metrics = state.auditState.metrics[aiId] || require('./features/audit-metrics').createInitialMetrics(aiId);

          let updatedMetrics = metrics;

          if (action === 'message') {
            updatedMetrics = recordMessage(metrics);
          } else if (action === 'challenge') {
            updatedMetrics = recordChallenge(metrics, data);
          } else if (action === 'outcome') {
            updatedMetrics = recordChallengeOutcome(metrics, data);
          }

          updateMetrics(aiId, updatedMetrics);

          return {
            auditState: {
              ...state.auditState,
              metrics: {
                ...state.auditState.metrics,
                [aiId]: updatedMetrics,
              },
            },
          };
        });
      },

      clearAuditData: () => {
        const { clearAuditData: clearData } = require('./features/audit-metrics');
        clearData();
        set({
          auditState: {
            metrics: {},
            history: [],
          },
        });
      },

      // 串行引用配置操作 (Phase 2 - Feature 1)
      updateSerialConfig: (newConfig) =>
        set((state) => ({
          serialConfig: { ...state.serialConfig, ...newConfig },
        })),

      // 自动挑刺配置操作 (Phase 2 - Feature 2)
      updateAutoChallengeConfig: (newConfig) =>
        set((state) => ({
          autoChallengeConfig: { ...state.autoChallengeConfig, ...newConfig },
        })),

      // 多AI投票配置操作 (Phase 2 - Feature 4)
      updateAIProviders: (newProviders) =>
        set((state) => ({
          aiProviders: { ...state.aiProviders, ...newProviders },
        })),

      updateVotingConfig: (newConfig) =>
        set((state) => ({
          votingConfig: { ...state.votingConfig, ...newConfig },
        })),

      setVotingResult: (result) =>
        set({ votingResult: result }),
    }),
    {
      name: 'ai-adversarial-storage',
      // 只持久化settings和部分UI状态，不持久化debateState（每次会话重新开始）
      partialize: (state) => ({
        settings: state.settings,
        serialConfig: state.serialConfig, // Phase 2 - Feature 1
        autoChallengeConfig: state.autoChallengeConfig, // Phase 2 - Feature 2
        aiProviders: state.aiProviders, // Phase 2 - Feature 4
        votingConfig: state.votingConfig, // Phase 2 - Feature 4
      }),
    }
  )
);

/**
 * Selector hooks - 优化性能，避免不必要的重渲染
 */
export const useDebateState = () => useAppStore((state) => state.debateState);
export const useSettings = () => useAppStore((state) => state.settings);
export const useErrors = () => useAppStore((state) => state.errors);
export const useIsStreaming = () => useAppStore((state) => state.debateState.isStreaming);
