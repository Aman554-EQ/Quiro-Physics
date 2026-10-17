import { sleep, type ChatTransport } from "@/lib/chat/transport";
import { messageText, type StreamEvent } from "@/shared/ui-message";

import { pickScript, type MockScript } from "./scripts";

export const GUEST_TURN_LIMIT = 6;
export const MOCK_SPEED_KEY = "prc-mock-speed";

/** Split text into token-sized pieces (≤ 4 chars, whitespace kept) like an LLM stream. */
export function tokenize(text: string): string[] {
  return text.match(/\s+|[^\s]{1,4}/g) ?? [];
}

export interface MockTransportOptions {
  /** ms per token; a function for random jitter. Default 15–40 ms. */
  tokenDelay?: number | (() => number);
  /** Override the script picker (tests replay fixtures). */
  script?: (question: string) => MockScript;
  /** Pre-recorded event list to replay instead of a script. */
  events?: StreamEvent[];
  turnLimit?: number;
}

function defaultDelay(): number | (() => number) {
  try {
    if (typeof localStorage !== "undefined" && localStorage.getItem(MOCK_SPEED_KEY) === "fast") return 1;
  } catch {}
  return () => 15 + Math.random() * 25;
}

/**
 * Phase 1 stand-in for `/api/chat`, kept for component tests (the app uses the HTTP transport and the
 * server-side demo tutor since Phase 2). Keeps a per-thread guest turn count.
 */
export function createMockTransport(opts: MockTransportOptions = {}): ChatTransport {
  const turns = new Map<string, number>();
  const limit = opts.turnLimit ?? GUEST_TURN_LIMIT;
  const delayOpt = opts.tokenDelay ?? defaultDelay();
  const delay = () => (typeof delayOpt === "function" ? delayOpt() : delayOpt);

  let threadCounter = 0;
  return {
    async *send({ thread, message, signal }) {
      if (opts.events) {
        for (const ev of opts.events) {
          if (ev.type === "text-delta" || ev.type === "reasoning-delta") await sleep(delay(), signal);
          yield ev;
        }
        return;
      }

      const question = messageText(message);
      const script = (opts.script ?? pickScript)(question);
      const threadId = thread?.id ?? `mock-thread-${++threadCounter}`;
      if (!thread) yield { type: "data-thread", data: { kind: "guest", id: threadId } };
      const used = (turns.get(threadId) ?? 0) + 1;
      turns.set(threadId, used);

      yield { type: "data-status", data: { stage: "observe" } };
      await sleep(Math.min(250, delay() * 8), signal);
      yield { type: "data-route", data: script.route };

      if (script.sources?.length) {
        yield { type: "data-status", data: { stage: "measure" } };
        await sleep(Math.min(300, delay() * 10), signal);
        yield { type: "data-sources", data: script.sources };
      }

      yield { type: "data-status", data: { stage: "derive" } };
      if (script.reasoning) {
        for (const tok of tokenize(script.reasoning)) {
          await sleep(delay() / 2, signal);
          yield { type: "reasoning-delta", delta: tok };
        }
        yield { type: "reasoning-end" };
      }
      for (const tok of tokenize(script.text)) {
        await sleep(delay(), signal);
        yield { type: "text-delta", delta: tok };
      }

      yield { type: "data-status", data: { stage: "verify" } };
      await sleep(Math.min(150, delay() * 4), signal);
      if (script.sources?.length) yield { type: "data-sources", data: script.sources };
      yield {
        type: "data-limit",
        data: { kind: "guest_turns", remaining: Math.max(0, limit - used), limit },
      };
      yield {
        type: "data-usage",
        data: {
          model: "mock-tutor",
          fallbackUsed: false,
          promptTokens: 0,
          completionTokens: tokenize(script.text).length,
        },
      };
      yield { type: "finish" };
    },
  };
}
