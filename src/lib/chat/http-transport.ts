import type { ChatRequest } from "@/shared/chat-api";
import { messageText, type Limit, type StreamEvent } from "@/shared/ui-message";

import type { ChatTransport, SendInput } from "./transport";

/**
 * The real transport: POST /api/chat and read the AI SDK UI message stream (SSE).
 * The body holds only `{ conversationId | guestThreadId, message, documentIds, regenerate }`; the
 * server rebuilds history itself and never trusts the client's copy (STREAMING.md §2, P2-S4-A06).
 */
export function buildChatRequest(input: Pick<SendInput, "thread" | "message" | "regenerate">): ChatRequest {
  return {
    ...(input.thread?.kind === "conversation" ? { conversationId: input.thread.id } : {}),
    ...(input.thread?.kind === "guest" ? { guestThreadId: input.thread.id } : {}),
    message: { id: input.message.id, text: messageText(input.message) },
    documentIds: [],
    regenerate: input.regenerate ?? false,
  };
}

/** Limit errors (HTTP 429 JSON) become a data-limit event so the banner can explain them. */
function limitFor(code: string, resetAt?: string): Limit | null {
  switch (code) {
    case "GUEST_TURN_LIMIT":
      return { kind: "guest_turns", remaining: 0, limit: 6 };
    case "GUEST_DAILY_LIMIT":
      return { kind: "guest_daily", remaining: 0, limit: 3, resetAt };
    case "DAILY_MESSAGE_LIMIT":
      return { kind: "user_daily", remaining: 0, limit: 50, resetAt };
    case "RATE_LIMITED":
      return { kind: "rate", remaining: 0, limit: 1, resetAt };
    default:
      return null;
  }
}

type Chunk = { type: string; [k: string]: unknown };

function toEvent(c: Chunk): StreamEvent | null {
  switch (c.type) {
    case "text-delta":
      return { type: "text-delta", delta: String(c.delta ?? "") };
    case "reasoning-delta":
      return { type: "reasoning-delta", delta: String(c.delta ?? "") };
    case "reasoning-end":
      return { type: "reasoning-end" };
    case "data-status":
    case "data-route":
    case "data-sources":
    case "data-limit":
    case "data-usage":
    case "data-thread":
      return { type: c.type, data: c.data } as StreamEvent;
    case "error":
      return { type: "error", message: String(c.errorText ?? "Something went wrong.") };
    case "finish":
      return { type: "finish" };
    default:
      return null; // start, text-start/end, reasoning-start, steps, abort
  }
}

async function* readSse(body: ReadableStream<Uint8Array>): AsyncGenerator<Chunk> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }).replaceAll("\r\n", "\n");
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) >= 0) {
      const event = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      for (const line of event.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try {
          yield JSON.parse(data) as Chunk;
        } catch {
          // ignore malformed lines
        }
      }
    }
  }
}

export function createHttpTransport(endpoint = "/api/chat"): ChatTransport {
  return {
    async *send(input) {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildChatRequest(input)),
        signal: input.signal,
      });
      if (!res.ok || !res.body) {
        const err = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string; resetAt?: string } } | null;
        const code = err?.error?.code ?? "HTTP_ERROR";
        const limit = limitFor(code, err?.error?.resetAt);
        if (limit) yield { type: "data-limit", data: limit };
        yield { type: "error", code, message: err?.error?.message ?? "The tutor couldn't be reached. Please try again." };
        return;
      }
      for await (const chunk of readSse(res.body)) {
        const ev = toEvent(chunk);
        if (ev) yield ev;
      }
    },
  };
}
