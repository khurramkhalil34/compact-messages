import type { Message } from "./types.js";

/**
 * Rough token estimate for one message.
 *
 * This is deliberately NOT exact. The common rule of thumb for English text is
 * about 4 characters per token, and that is accurate enough to make trimming
 * decisions without pulling in a heavy tokenizer dependency.
 *
 * If you need precision (for example, billing-accurate counts), pass your own
 * function via the `estimateTokens` option in `compact()`.
 */
export function estimateTokens(message: Message): number {
  const body =
    typeof message.content === "string"
      ? message.content
      : JSON.stringify(message.content ?? "");

  const toolCalls = message.tool_calls
    ? JSON.stringify(message.tool_calls)
    : "";

  return Math.ceil((body.length + toolCalls.length) / 4);
}
