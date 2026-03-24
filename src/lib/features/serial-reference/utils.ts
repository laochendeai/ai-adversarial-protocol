/**
 * 串行互相引用工具函数
 * Serial Reference Utilities
 */

import { SerialReferenceConfig, RoundType } from '@/lib/types';

/**
 * 选择先响应的AI
 */
export function selectFirstResponder(config: SerialReferenceConfig, lastResponder?: 'claude' | 'openai'): 'claude' | 'openai' {
  if (config.firstResponder === 'claude') return 'claude';
  if (config.firstResponder === 'openai') return 'openai';

  // auto模式：轮流
  if (lastResponder === 'claude') return 'openai';
  return 'claude';
}

/**
 * 确定本轮类型
 */
export function determineRoundType(config: SerialReferenceConfig): RoundType {
  if (!config.enabled) return 'parallel';
  if (config.mode === 'always-serial') {
    return 'serial-a-first'; // 具体哪个先在运行时确定
  }
  return 'parallel';
}

/**
 * 构建串行模式的prompt
 */
export function buildSerialPrompt(
  basePrompt: string,
  opponentMessage?: { content: string; isClaude: boolean }
): string {
  if (!opponentMessage) return basePrompt;

  const opponentName = opponentMessage.isClaude ? 'Claude' : 'OpenAI';

  return `${basePrompt}

**重要:** 另一个AI (${opponentName}) 在本轮已经给出了观点。

**对方的观点：**
"""
${opponentMessage.content}
"""

**你的任务：**
1. **仔细阅读对方的观点** — 理解它的核心论点
2. **寻找问题** — 检查是否有事实错误、逻辑漏洞、遗漏要点
3. **礼貌反驳或补充** — 如果发现问题，明确指出；如果没有，表示同意并补充你的视角

**目标：** 找到真相，而不是赢得辩论。如果对方是对的，坦诚承认。
`.trim();
}

/**
 * 计算串行模式超时时间
 */
export function getSerialTimeouts() {
  return {
    firstResponder: 60000,      // 第一个AI：60秒
    secondResponder: 90000,     // 第二个AI：90秒（需要阅读对方观点）
    totalTimeout: 180000,       // 总超时：3分钟
  };
}

/**
 * 生成引用摘要
 */
export function generateReferenceSummary(content: string, maxLength: number = 100): string {
  const stripped = content.trim();
  if (stripped.length <= maxLength) return stripped;

  // 简单的截断并添加省略号
  return stripped.substring(0, maxLength - 3) + '...';
}

/**
 * 检查是否应该触发串行模式
 */
export function shouldTriggerSerial(config: SerialReferenceConfig): boolean {
  if (!config.enabled) return false;
  if (config.mode === 'always-serial') return true;
  if (config.mode === 'hybrid') {
    // TODO: 实现分歧检测逻辑
    // 暂时返回false，等待Feature 2实现
    return false;
  }
  return false;
}
