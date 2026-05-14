import type { Message } from "./types.js";

/**
 * An atomic unit of conversation.
 *
 * It is either a single plain message, OR an assistant tool-call message
 * bundled together with the tool-result message(s) that answer it.
 *
 * Units are NEVER split. That is the entire reason this file exists: if you
 * send a tool call to the model without its result (or a result without its
 * call), the provider API rejects the whole request. Naive trimming that just
 * slices a message array hits this constantly. Trimming whole units does not.
 */
export interface MessageUnit {
  messages: Message[];
  isSystem: boolean;
}

/** Is this an assistant message that is calling one or more tools? */
function isToolCall(message: Message): boolean {
  if (message.role !== "assistant") return false;

  // OpenAI / Anthropic style: a top-level tool_calls array.
  if (Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
    return true;
  }

  // Vercel AI SDK style: content is an array of parts, one of type "tool-call".
  if (Array.isArray(message.content)) {
    return message.content.some(
      (part) => (part as { type?: string })?.type === "tool-call",
    );
  }

  return false;
}

/** Is this a tool-result message? */
function isToolResult(message: Message): boolean {
  return message.role === "tool";
}

/**
 * Group a flat message array into atomic units.
 *
 * Walk the array left to right. System messages become their own unit. An
 * assistant tool-call message is bundled with every tool-result message that
 * immediately follows it. Everything else is a plain one-message unit.
 */
export function toUnits(messages: Message[]): MessageUnit[] {
  const units: MessageUnit[] = [];
  let i = 0;

  while (i < messages.length) {
    const message = messages[i];

    if (message.role === "system") {
      units.push({ messages: [message], isSystem: true });
      i += 1;
      continue;
    }

    if (isToolCall(message)) {
      const bundle: Message[] = [message];
      let j = i + 1;
      while (j < messages.length && isToolResult(messages[j])) {
        bundle.push(messages[j]);
        j += 1;
      }
      units.push({ messages: bundle, isSystem: false });
      i = j;
      continue;
    }

    units.push({ messages: [message], isSystem: false });
    i += 1;
  }

  return units;
}

/** Flatten units back into a plain message array. */
export function fromUnits(units: MessageUnit[]): Message[] {
  return units.flatMap((unit) => unit.messages);
}
