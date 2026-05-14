# compact-messages

Safely trim a long LLM conversation so it fits within a token budget, without ever breaking a tool call away from its result.

Framework-agnostic. Zero runtime dependencies. Works in Next.js API routes, plain Node, workers, anywhere.

## The problem

A chat conversation keeps growing. The model can only read a limited amount of text at once, and you pay for every token on every request. So once a conversation gets long, you have to remove old messages before sending.

The naive way is to slice the array and keep the last N messages. That breaks, because an assistant message that calls a tool and the message that returns the tool result depend on each other. Send one without the other and the provider API rejects the whole request.

`compact-messages` does the trimming the safe way: it groups messages into atomic units (a plain message, or a tool call bundled with its result) and only ever keeps or drops whole units.

## Install

```bash
npm install compact-messages
```

## Use

```ts
import { compact } from "compact-messages";

const result = compact(messages, {
  maxTokens: 8000,   // target ceiling for the returned conversation
  keepRecent: 6,     // always keep the last 6 units
  keepSystem: true,  // always keep system messages (default)
});

// result.messages -> the trimmed array, safe to send to the model
// result.stats    -> what happened, e.g. { droppedCount: 12, finalTokens: 7840, ... }
```

### In a Next.js API route

Compaction runs on the server, right before you call the model.

```ts
import { compact, needsCompaction } from "compact-messages";

export async function POST(req: Request) {
  const { messages } = await req.json();

  const safeMessages = needsCompaction(messages, { maxTokens: 8000 })
    ? compact(messages, { maxTokens: 8000, keepRecent: 6 }).messages
    : messages;

  // ...now call Claude / OpenAI with safeMessages
}
```

## Options

| Option | Default | What it does |
| --- | --- | --- |
| `maxTokens` | (required) | Target token ceiling for the returned conversation. |
| `keepRecent` | `4` | Always keep the last N units. A unit is one message, or a tool call plus its result. |
| `keepSystem` | `true` | Always keep system messages regardless of budget. |
| `estimateTokens` | chars / 4 | Custom token counter for one message. Swap in a real tokenizer if you need exact counts. |

## How it counts tokens

By default it uses a rough characters-divided-by-4 estimate. That is good enough to make trimming decisions and keeps the package dependency-free. If you need billing-accurate counts, pass your own `estimateTokens` function.

## What this does NOT do (yet)

Kept deliberately small. These are intentionally out of scope for v1:

- **Summarizing** dropped messages instead of deleting them. (Planned for v2.)
- **Persistence.** You own your database; this is a pure transform.
- **Conversation branching or memory.** Different problem, different package.

## License

MIT. See [LICENSE](./LICENSE).
