export type MessageRole = "system" | "user" | "assistant" | "tool";

/**
 * A loose, provider-agnostic message shape.
 *
 * It is intentionally permissive so the same code works with the Vercel AI SDK,
 * the OpenAI SDK, and the Anthropic SDK message formats. `content` can be a
 * plain string or an array of content parts.
 */
export interface Message {
  role: MessageRole;
  content: unknown;
  /** Present on assistant messages that call tools (OpenAI style). */
  tool_calls?: unknown[];
  /** Present on tool-result messages (OpenAI style). */
  tool_call_id?: string;
  /** Any other provider-specific fields are preserved untouched. */
  [key: string]: unknown;
}

export interface CompactionOptions {
  /** Target token ceiling for the returned conversation. */
  maxTokens: number;
  /**
   * Always keep the last N units. A "unit" is one plain message, or one
   * assistant tool-call bundled with its tool-result message(s). Default: 4.
   */
  keepRecent?: number;
  /** Always keep system messages regardless of budget. Default: true. */
  keepSystem?: boolean;
  /**
   * Custom token counter for a single message. Default: a rough
   * characters-divided-by-4 estimate that needs no tokenizer dependency.
   */
  estimateTokens?: (message: Message) => number;
}

export interface CompactionResult {
  /** The trimmed message array, safe to send straight to the model. */
  messages: Message[];
  /** A summary of what happened. Handy for logging. */
  stats: {
    originalCount: number;
    keptCount: number;
    droppedCount: number;
    originalTokens: number;
    finalTokens: number;
  };
}
