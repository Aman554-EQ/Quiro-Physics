import { messageText, type ChatMessage, type MessagePart } from "@/shared/ui-message";

type TextPart = Extract<MessagePart, { type: "text" }>;

/**
 * Smooth reveal (STREAMING.md §6). Groq can generate 1,000+ tokens/s, so a whole answer arrives in
 * a fraction of a second and reads as "all at once". The client shows received text at a steady
 * reading pace instead, like ChatGPT and Claude: never slower than REVEAL_CHARS_PER_SEC, and fast
 * enough to stay within REVEAL_MAX_LAG_MS of what has arrived (long answers don't drag on).
 */
export const REVEAL_TICK_MS = 30;
/** ≈ 60 tokens/s. */
export const REVEAL_CHARS_PER_SEC = 240;
export const REVEAL_MAX_LAG_MS = 3_000;

/** Characters to reveal this tick, given how much received text is still hidden. */
export function revealStep(backlog: number, dtMs: number) {
  if (backlog <= 0) return 0;
  const cps = Math.max(REVEAL_CHARS_PER_SEC, (backlog * 1000) / REVEAL_MAX_LAG_MS);
  return Math.min(backlog, Math.max(1, Math.round((cps * dtMs) / 1000)));
}

/** Move a cut point forward to the end of the current word (at most 12 chars) so words appear whole. */
export function snapToWord(text: string, cut: number) {
  if (cut >= text.length) return text.length;
  const limit = Math.min(text.length, cut + 12);
  for (let i = cut; i < limit; i++) if (/\s/.test(text[i]!)) return i;
  return cut;
}

export function textLength(m: Pick<ChatMessage, "parts">) {
  return messageText(m).length;
}

/** The message with only the first `chars` characters of its text visible (other parts untouched). */
export function truncateText(m: ChatMessage, chars: number): ChatMessage {
  let left = chars;
  const parts = m.parts.flatMap((p) => {
    if (p.type !== "text") return [p];
    if (left <= 0) return [];
    const text = (p as TextPart).text.slice(0, left);
    left -= text.length;
    return [{ ...p, text }];
  });
  return { ...m, parts };
}
