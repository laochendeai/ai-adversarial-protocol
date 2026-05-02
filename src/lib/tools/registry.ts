/**
 * ToolRegistry — 注册表 + 调度器
 *
 * 每个 AdversarialEngine 实例构造一个 registry，注册四个工具（search、fetch_url、
 * exec_python、concede），生成阶段把 registry 的 list() 作为 tool defs 传给模型，
 * 收到 tool_call 时 dispatch() 路由到对应 handler。
 */

import { ToolCall, ToolCtx, ToolDefinition, ToolHandler, ToolResult } from './types';

interface Entry {
  def: ToolDefinition;
  handler: ToolHandler;
}

export class ToolRegistry {
  private readonly tools = new Map<string, Entry>();

  register(def: ToolDefinition, handler: ToolHandler): void {
    if (this.tools.has(def.name)) {
      throw new Error(`Tool already registered: ${def.name}`);
    }
    this.tools.set(def.name, { def, handler });
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  /** 给模型看的工具定义列表（用于 OpenAI tools 字段）。hidden 工具也会出现——
   *  hidden 的语义是"不外发到第三方服务"，模型仍然能看到并调用。 */
  list(): ToolDefinition[] {
    return [...this.tools.values()].map(e => e.def);
  }

  async dispatch(call: ToolCall, ctx: ToolCtx): Promise<ToolResult> {
    const entry = this.tools.get(call.name);
    if (!entry) {
      return { id: call.id, ok: false, error: `unknown tool: ${call.name}` };
    }
    try {
      const result = await entry.handler(call.args, ctx);
      // handler 应该自己设 id，但保险起见统一覆盖
      return { ...result, id: call.id };
    } catch (err) {
      return {
        id: call.id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
