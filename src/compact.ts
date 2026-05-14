import type { CompactionOptions, CompactionResult, Message } from "./types.js";
import { estimateTokens as defaultEstimate } from "./tokens.js";
import { toUnits, fromUnits, type MessageUnit } from "./units.js";

/**
 * Trim a conversation so it fits within `maxTokens`, without ever breaking a
 * tool call away from its result.
 *
 * Strategy (v1): keep all system messages, keep the most recent `keepRecent`
 * units, then drop the oldest remaining units one at a time until the
 * conversation is under budget.
 *
 * If even the protected messages alone exceed `maxTokens`, the function
 * returns them anyway. It will not drop something you told it to keep. In that
 * case `stats.finalTokens` will be above `maxTokens`, so you can detect it.
 */
export function compact(
  messages: Message[],
  options: CompactionOptions,
): CompactionResult {
  const keepRecent = options.keepRecent ?? 4;
  const keepSystem = options.keepSystem ?? true;
  const estimate = options.estimateTokens ?? defaultEstimate;

  const unitTokens = (unit: MessageUnit): number =>
    unit.messages.reduce((sum, message) => sum + estimate(message), 0);

  const units = toUnits(messages);
  const originalTokens = units.reduce((sum, unit) => sum + unitTokens(unit), 0);

  // Mark which units are protected and must not be dropped.
  const isProtected = new Array<boolean>(units.length).fill(false);

  if (keepSystem) {
    units.forEach((unit, index) => {
      if (unit.isSystem) isProtected[index] = true;
    });
  }

  // Protect the last `keepRecent` non-system units.
  let recentProtected = 0;
  for (
    let index = units.length - 1;
    index >= 0 && recentProtected < keepRecent;
    index--
  ) {
    if (!units[index].isSystem) {
      isProtected[index] = true;
      recentProtected += 1;
    }
  }

  // Drop the oldest droppable units until we are under budget.
  const dropped = new Array<boolean>(units.length).fill(false);
  let runningTotal = originalTokens;

  for (
    let index = 0;
    index < units.length && runningTotal > options.maxTokens;
    index++
  ) {
    if (isProtected[index]) continue;
    dropped[index] = true;
    runningTotal -= unitTokens(units[index]);
  }

  const keptUnits = units.filter((_, index) => !dropped[index]);
  const keptMessages = fromUnits(keptUnits);
  const finalTokens = keptUnits.reduce((sum, unit) => sum + unitTokens(unit), 0);

  return {
    messages: keptMessages,
    stats: {
      originalCount: messages.length,
      keptCount: keptMessages.length,
      droppedCount: messages.length - keptMessages.length,
      originalTokens,
      finalTokens,
    },
  };
}

/**
 * Quick check: is this conversation over budget? Use it to skip the work of
 * compacting when you do not need to.
 */
export function needsCompaction(
  messages: Message[],
  options: CompactionOptions,
): boolean {
  const estimate = options.estimateTokens ?? defaultEstimate;
  const total = messages.reduce((sum, message) => sum + estimate(message), 0);
  return total > options.maxTokens;
}
