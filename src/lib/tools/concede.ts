/**
 * concede 工具 — 模型主动认错退出
 *
 * 设计目标：在工具调用过程中，如果模型基于 search/exec_python 的证据发现
 * 自己之前的回答是错的，可以调用 concede() 主动退出本次 run，可选地
 * "defer to" 另一个模型。
 *
 * 这个工具不向外发出请求——dispatch 直接更新引擎里的 ConcessionTracker。
 * 求真原则：诚实承认错误是高 honor 信号，audit metrics 会奖励。
 */

import { ToolDefinition, ToolHandler } from './types';

export interface ConcessionRecord {
  modelId: string;
  reason: string;
  deferTo?: string;        // 另一个 modelId（必须存在于本次 run 中）
  timestamp: number;
}

export interface ConcessionTracker {
  record(c: ConcessionRecord): void;
  isWithdrawn(modelId: string): boolean;
  list(): ConcessionRecord[];
}

export class InMemoryConcessionTracker implements ConcessionTracker {
  private readonly records: ConcessionRecord[] = [];
  private readonly withdrawn = new Set<string>();

  record(c: ConcessionRecord): void {
    if (this.withdrawn.has(c.modelId)) return;     // first concession sticks
    this.records.push(c);
    this.withdrawn.add(c.modelId);
  }
  isWithdrawn(modelId: string): boolean {
    return this.withdrawn.has(modelId);
  }
  list(): ConcessionRecord[] {
    return [...this.records];
  }
}

export const concedeToolDef: ToolDefinition = {
  name: 'concede',
  description:
    '当你看到 search 或 exec_python 等工具结果后，如果发现自己之前的回答是错的，' +
    '请使用此工具主动承认错误并退出本次评估。诚实认错在 AAP 中被视为高 honor，比硬撑结果更值得鼓励。' +
    '可选 defer_to 字段填你认为现在最有可能正确的同行模型 id。',
  parameters: {
    type: 'object',
    properties: {
      reason: {
        type: 'string',
        description: '简述你为什么改变看法（哪条证据让你改变了立场）',
      },
      defer_to: {
        type: 'string',
        description: '可选：你现在愿意背书的另一个模型的 id',
      },
    },
    required: ['reason'],
  },
  hidden: true,
};

export function makeConcedeHandler(tracker: ConcessionTracker): ToolHandler {
  return async (rawArgs, ctx) => {
    const args = rawArgs as { reason?: string; defer_to?: string };
    const reason = (args?.reason ?? '').trim();
    if (!reason) return { id: '', ok: false, error: 'reason is required' };

    tracker.record({
      modelId: ctx.modelId,
      reason,
      deferTo: args?.defer_to?.trim() || undefined,
      timestamp: Date.now(),
    });

    return {
      id: '',
      ok: true,
      content:
        '已记录你的认错声明。你将不参与本次 run 的最终投票评选，但你的诚实表态会计入 audit 评分。' +
        '请在你这条 message 中也用一句话向其他模型简单说明你为何改变看法（不需要继续详细回答）。',
    };
  };
}
