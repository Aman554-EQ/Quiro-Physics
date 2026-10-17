import type { ChatMessage, StreamEvent } from "@/shared/ui-message";

/** Which saved conversation or guest thread a turn belongs to (null = start a new one). */
export interface ThreadRef {
  kind: "conversation" | "guest";
  id: string;
}

export interface SendInput {
  thread: ThreadRef | null;
  /** Only the new user message is sent; the server owns the history (STREAMING.md §2). */
  message: ChatMessage;
  signal: AbortSignal;
  /** Replace the last answer instead of adding a new turn. */
  regenerate?: boolean;
}

/** Anything that turns a user message into a stream of UI message events. */
export interface ChatTransport {
  send(input: SendInput): AsyncIterable<StreamEvent>;
}

export class AbortedError extends Error {
  constructor() {
    super("Aborted");
    this.name = "AbortError";
  }
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new AbortedError());
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new AbortedError());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
