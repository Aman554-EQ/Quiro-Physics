import type { ChatMessage, MessagePart, StreamEvent } from "@/shared/ui-message";

/**
 * Pure reducer: fold one stream event into the assistant message.
 * Mirrors how AI SDK `useChat` builds `UIMessage.parts` from a UI message stream.
 */
export function applyEvent(message: ChatMessage, event: StreamEvent): ChatMessage {
  const parts = [...message.parts];
  const last = parts.at(-1);
  switch (event.type) {
    case "text-delta": {
      if (last?.type === "text") {
        const prev = last as Extract<MessagePart, { type: "text" }>;
        parts[parts.length - 1] = { type: "text", text: prev.text + event.delta };
      } else parts.push({ type: "text", text: event.delta });
      return { ...message, parts };
    }
    case "reasoning-delta": {
      const idx = parts.findIndex((p) => p.type === "reasoning");
      if (idx >= 0) {
        const r = parts[idx] as Extract<MessagePart, { type: "reasoning" }>;
        parts[idx] = { ...r, text: r.text + event.delta };
      } else parts.push({ type: "reasoning", text: event.delta });
      return { ...message, parts };
    }
    case "reasoning-end": {
      const idx = parts.findIndex((p) => p.type === "reasoning");
      if (idx >= 0) {
        const r = parts[idx] as Extract<MessagePart, { type: "reasoning" }>;
        const started = message.meta?.startedAt;
        parts[idx] = { ...r, durationMs: started ? Date.now() - started : undefined };
      }
      return { ...message, parts };
    }
    case "data-sources": {
      const idx = parts.findIndex((p) => p.type === "data-sources");
      const part = { type: "data-sources" as const, data: event.data };
      if (idx >= 0) parts[idx] = part;
      else parts.push(part);
      return { ...message, parts };
    }
    case "data-limit": {
      const idx = parts.findIndex((p) => p.type === "data-limit");
      const part = { type: "data-limit" as const, data: event.data };
      if (idx >= 0) parts[idx] = part;
      else parts.push(part);
      return { ...message, parts };
    }
    case "data-text-final": {
      // One text part holding the validated answer, where the first text part was.
      const first = parts.findIndex((p) => p.type === "text");
      const rest = parts.filter((p) => p.type !== "text");
      const at = first < 0 ? rest.length : first;
      rest.splice(at, 0, { type: "text", text: event.data.text });
      return { ...message, parts: rest };
    }
    case "data-status":
      return { ...message, meta: { ...message.meta, stage: event.data.stage } };
    case "data-route":
      return { ...message, meta: { ...message.meta, route: event.data } };
    case "data-usage":
      return { ...message, meta: { ...message.meta, usage: event.data } };
    case "finish":
      return { ...message, status: "complete" };
    case "error":
      return { ...message, status: "error", meta: { ...message.meta, error: event.message } };
    default:
      // Unknown event types from a newer server are ignored.
      return message;
  }
}
