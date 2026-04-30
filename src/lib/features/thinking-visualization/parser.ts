/**
 * 思维过程解析器
 * 提取 <thinking> 标签内容
 */

import { ThinkingBlock } from '@/lib/types';

export function extractThinkingBlocks(
  content: string,
  modelId: string
): ThinkingBlock[] {
  const blocks: ThinkingBlock[] = [];
  const regex = /<thinking>([\s\S]*?)<\/thinking>/g;
  let match;
  let order = 0;

  while ((match = regex.exec(content)) !== null) {
    blocks.push({
      modelId,
      content: match[1].trim(),
      order: order++,
      source: 'explicit-tag',
    });
  }

  return blocks;
}

export function removeThinkingTags(content: string): string {
  return content.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
}

export function hasThinkingTags(content: string): boolean {
  return /<thinking>[\s\S]*?<\/thinking>/.test(content);
}
