/**
 * Chat message contract shared by client and server.
 *
 * Part names deliberately mirror the AI SDK UI Message Stream (`text`, `reasoning`,
 * `data-*`), so Phase 2 can swap the mock transport for `useChat` + `streamText`
 * without touching the rendering components.
 */
import { z } from "zod";

export const PipelineStageSchema = z.enum(["observe", "measure", "derive", "verify"]);
export type Stage = z.infer<typeof PipelineStageSchema>;

export const SourceSchema = z.object({
  label: z.number().int().positive(),
  documentId: z.string().nullable(),
  title: z.string(),
  section: z.string().optional(),
  pageStart: z.number().int().positive(),
  pageEnd: z.number().int().positive(),
  quote: z.string().max(400),
  deleted: z.boolean().optional(),
});
export type Source = z.infer<typeof SourceSchema>;

export const LimitSchema = z.object({
  kind: z.enum(["guest_turns", "guest_daily", "user_daily", "rate"]),
  remaining: z.number().int().min(0),
  limit: z.number().int().positive(),
  resetAt: z.string().optional(),
});
export type Limit = z.infer<typeof LimitSchema>;

export const RouteInfoSchema = z.object({
  scope: z.enum(["physics", "physics_math", "study_meta", "greeting", "off_topic", "unsafe"]),
  queryType: z.enum(["concept", "numerical", "derivation", "textbook_lookup", "follow_up", "mixed"]),
  usingTextbook: z.boolean(),
});
export type RouteInfo = z.infer<typeof RouteInfoSchema>;

export const UsageSchema = z.object({
  model: z.string(),
  fallbackUsed: z.boolean(),
  promptTokens: z.number().int().min(0),
  completionTokens: z.number().int().min(0),
});

// ---- Persisted parts (what a message is made of) ----
export const TextPartSchema = z.object({ type: z.literal("text"), text: z.string() });
export const ReasoningPartSchema = z.object({
  type: z.literal("reasoning"),
  text: z.string(),
  durationMs: z.number().optional(),
});
export const SourcesPartSchema = z.object({ type: z.literal("data-sources"), data: z.array(SourceSchema) });
export const LimitPartSchema = z.object({ type: z.literal("data-limit"), data: LimitSchema });
/** Persisted so the route badge survives a reload (P2-S4-A11). */
export const RoutePartSchema = z.object({ type: z.literal("data-route"), data: RouteInfoSchema });

export const MessagePartSchema = z.discriminatedUnion("type", [
  TextPartSchema,
  ReasoningPartSchema,
  SourcesPartSchema,
  LimitPartSchema,
  RoutePartSchema,
]);
export type MessagePart = z.infer<typeof MessagePartSchema>;

export type MessageStatus = "streaming" | "complete" | "cancelled" | "error";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  /** Unknown part types (from newer servers) are kept but ignored by the renderer. */
  parts: Array<MessagePart | { type: string; [k: string]: unknown }>;
  status: MessageStatus;
  /** Transient stream state — not persisted */
  meta?: {
    stage?: Stage;
    route?: RouteInfo;
    usage?: z.infer<typeof UsageSchema>;
    startedAt?: number;
    /** Human-readable reason when status is "error" (limit reached, model unavailable, …). */
    error?: string;
  };
}

// ---- Stream events (one chunk of the SSE stream) ----
export type StreamEvent =
  | { type: "text-delta"; delta: string }
  | { type: "reasoning-delta"; delta: string }
  | { type: "reasoning-end" }
  | { type: "data-status"; data: { stage: Stage } }
  | { type: "data-route"; data: RouteInfo }
  | { type: "data-sources"; data: Source[] }
  | { type: "data-limit"; data: Limit }
  | { type: "data-usage"; data: z.infer<typeof UsageSchema> }
  | { type: "data-thread"; data: { kind: "conversation" | "guest"; id: string; title?: string } }
  /** The validated answer text (unverifiable citations removed): replaces the streamed text. */
  | { type: "data-text-final"; data: { text: string } }
  | { type: "finish" }
  | { type: "error"; message: string; code?: string };

export function messageText(m: Pick<ChatMessage, "parts">): string {
  return m.parts
    .filter((p): p is z.infer<typeof TextPartSchema> => p.type === "text")
    .map((p) => p.text)
    .join("");
}

export function messageSources(m: Pick<ChatMessage, "parts">): Source[] {
  const part = m.parts.findLast((p) => p.type === "data-sources") as
    z.infer<typeof SourcesPartSchema> | undefined;
  return part?.data ?? [];
}

export const MAX_MESSAGE_CHARS = 4000;
