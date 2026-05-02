/**
 * 工具调用核心类型
 *
 * AAP 的工具系统目标是把"求真"逻辑从模型权重内部拉到外部可证伪证据。
 * 工具按 OpenAI tool/function 格式定义，可被各模型在生成阶段主动调用。
 */

export type JSONSchema = Record<string, unknown>;

export interface ToolDefinition {
  /** 工具名，必须是合法 JS 标识符（OpenAI 限制） */
  name: string;
  /** 给模型看的描述。要写清"何时该调用"，写错就没人调它。 */
  description: string;
  /** OpenAI tool function 参数 schema */
  parameters: JSONSchema;
  /**
   * 标记为"内部工具"——例如 concede。
   * 内部工具不通过外部 HTTP 发出，由引擎本地拦截实现。
   */
  hidden?: boolean;
}

export interface ToolCall {
  id: string;          // 模型给的 call id（OpenAI tool_call_id）
  name: string;
  args: unknown;       // 解析后的 JSON
}

export type ToolResult =
  | { id: string; ok: true; content: string }
  | { id: string; ok: false; error: string };

/** 调度上下文。让 handler 知道是谁、为哪次 run 在调。 */
export interface ToolCtx {
  modelId: string;
  runId: string;
  signal?: AbortSignal;
}

export type ToolHandler = (args: unknown, ctx: ToolCtx) => Promise<ToolResult>;
