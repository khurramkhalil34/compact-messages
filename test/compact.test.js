// Plain JavaScript test file. It runs against the compiled package in dist/,
// so it needs nothing but Node itself. No tsx, no esbuild, no native binaries.
// Run it with: npm test  (which builds first, then runs this).

import { test } from "node:test";
import assert from "node:assert/strict";

import { compact, needsCompaction, toUnits } from "../dist/index.js";

/** Build a message of roughly `tokens` size (estimator is ~4 chars per token). */
function msg(role, tokens, extra = {}) {
  return { role, content: "x".repeat(tokens * 4), ...extra };
}

test("keeps everything when already under budget", () => {
  const messages = [msg("user", 10), msg("assistant", 10)];
  const result = compact(messages, { maxTokens: 1000 });

  assert.equal(result.messages.length, 2);
  assert.equal(result.stats.droppedCount, 0);
});

test("drops oldest messages when over budget", () => {
  const messages = [
    msg("user", 100), // oldest
    msg("assistant", 100),
    msg("user", 100),
    msg("assistant", 100), // newest
  ];
  const result = compact(messages, { maxTokens: 250, keepRecent: 2 });

  assert.ok(result.stats.finalTokens <= 250, "should be under budget");
  assert.equal(result.messages.length, 2, "should keep the 2 most recent");
});

test("always keeps system messages", () => {
  const messages = [
    msg("system", 100),
    msg("user", 100),
    msg("assistant", 100),
    msg("user", 100),
  ];
  const result = compact(messages, { maxTokens: 150, keepRecent: 1 });

  assert.equal(result.messages[0].role, "system");
});

test("never splits a tool call from its result", () => {
  const messages = [
    msg("user", 100),
    msg("assistant", 100, { tool_calls: [{ id: "t1", name: "search" }] }),
    msg("tool", 100, { tool_call_id: "t1" }),
    msg("user", 50),
    msg("assistant", 50),
  ];
  const result = compact(messages, { maxTokens: 160, keepRecent: 2 });

  const hasToolCall = result.messages.some((m) => Array.isArray(m.tool_calls));
  const hasToolResult = result.messages.some((m) => m.role === "tool");

  // The tool call and its result must travel together: either both survive or
  // both are dropped. They are never separated.
  assert.equal(hasToolCall, hasToolResult);
});

test("toUnits bundles an assistant tool call with the following tool result", () => {
  const messages = [
    msg("assistant", 10, { tool_calls: [{ id: "t1" }] }),
    msg("tool", 10, { tool_call_id: "t1" }),
  ];
  const units = toUnits(messages);

  assert.equal(units.length, 1, "the call and result form one unit");
  assert.equal(units[0].messages.length, 2);
});

test("needsCompaction reports correctly", () => {
  assert.equal(needsCompaction([msg("user", 10)], { maxTokens: 5 }), true);
  assert.equal(needsCompaction([msg("user", 10)], { maxTokens: 100 }), false);
});

test("stats add up", () => {
  const messages = [msg("user", 100), msg("assistant", 100), msg("user", 100)];
  const result = compact(messages, { maxTokens: 150, keepRecent: 1 });

  assert.equal(
    result.stats.keptCount + result.stats.droppedCount,
    result.stats.originalCount,
  );
});
