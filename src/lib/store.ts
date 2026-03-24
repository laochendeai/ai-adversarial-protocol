/**
 * Zustand Store - 状态管理
 * 处理DebateState、AppSettings、错误状态等
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DebateState, Message, Challenge, AppSettings, ProviderConfig } from './types';
import { getClientConfig, saveSettings, DEFAULT_SETTINGS } from './config';
import { saveConversation, clearConversation as clearConv } from './conversation-store';

interface AppState {
  // Debate状态
  debateState: DebateState;

  // 更新debate状态
  addMessage: (message: Message) => void;
  updateMessage: (messageId: string, content: string) => void;
  addChallenge: (challenge: Challenge) => void;
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

      // Debate状态操作
      addMessage: (message) =>
        set((state) => {
          const newState = {
            ...state.debateState,
            messages: [...state.debateState.messages, message],
          };
          // 自动保存到LocalStorage
          saveConversation(newState);
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
    }),
    {
      name: 'ai-adversarial-storage',
      // 只持久化settings和部分UI状态，不持久化debateState（每次会话重新开始）
      partialize: (state) => ({
        settings: state.settings,
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
