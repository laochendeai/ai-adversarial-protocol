/**
 * 对话历史持久化
 * 使用LocalStorage保存和恢复对话状态
 */

import { DebateState } from './types';

const CONVERSATION_STORAGE_KEY = 'ai-adversarial-conversation';

/**
 * 保存对话状态到LocalStorage
 */
export function saveConversation(debateState: DebateState): void {
  if (typeof window === 'undefined') return;

  try {
    // 只保存必要的数据，不保存isStreaming状态
    const toSave: Omit<DebateState, 'isStreaming'> = {
      messages: debateState.messages,
      challenges: debateState.challenges,
      tokenCount: debateState.tokenCount,
    };

    localStorage.setItem(CONVERSATION_STORAGE_KEY, JSON.stringify(toSave));
  } catch (error) {
    console.error('Failed to save conversation:', error);
  }
}

/**
 * 从LocalStorage加载对话状态
 */
export function loadConversation(): Partial<DebateState> | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(CONVERSATION_STORAGE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored);

    // 过滤掉旧格式的消息（没有 -claude 或 -openai 后缀的）
    const messages = (parsed.messages || []).filter((msg: any) => {
      if (!msg.id) return false;
      // 新格式: timestamp-random-{claude|openai}
      // 旧格式: timestamp-random 或纯 timestamp
      const isNewFormat = msg.id.includes('-claude') || msg.id.includes('-openai') || msg.role === 'user';
      return isNewFormat;
    });

    // 如果过滤掉了旧消息，更新 LocalStorage
    if (messages.length !== (parsed.messages || []).length) {
      console.log(`🧹 清理了 ${(parsed.messages || []).length - messages.length} 条旧格式消息`);
      const cleaned = {
        ...parsed,
        messages,
      };
      localStorage.setItem(CONVERSATION_STORAGE_KEY, JSON.stringify(cleaned));
    }

    return {
      messages,
      challenges: parsed.challenges || [],
      tokenCount: parsed.tokenCount || { claude: 0, openai: 0 },
      isStreaming: false,
    };
  } catch (error) {
    console.error('Failed to load conversation:', error);
    return null;
  }
}

/**
 * 清除对话历史
 */
export function clearConversation(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(CONVERSATION_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear conversation:', error);
  }
}

/**
 * 导出对话历史为JSON
 */
export function exportConversation(): string {
  const stored = localStorage.getItem(CONVERSATION_STORAGE_KEY);
  if (!stored) return '{}';

  try {
    const data = JSON.parse(stored);
    return JSON.stringify(data, null, 2);
  } catch (error) {
    console.error('Failed to export conversation:', error);
    return '{}';
  }
}

/**
 * 从JSON导入对话历史
 */
export function importConversation(jsonString: string): boolean {
  try {
    const data = JSON.parse(jsonString);

    // 验证数据格式
    if (!data.messages || !Array.isArray(data.messages)) {
      throw new Error('Invalid conversation format');
    }

    localStorage.setItem(CONVERSATION_STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('Failed to import conversation:', error);
    return false;
  }
}
