/**
 * `/api/chat` and `/api/limits` contracts, shared by the client transport and the server.
 * The client sends ONLY the new message; the server rebuilds history itself (STREAMING.md §2).
 */
import { z } from "zod";

import { MAX_MESSAGE_CHARS } from "./ui-message";

export const ChatRequestSchema = z.object({
  conversationId: z.string().uuid().optional(),
  guestThreadId: z.string().uuid().optional(),
  message: z.object({
    id: z.string().min(1).max(100),
    text: z.string().trim().min(1, "Message is empty").max(MAX_MESSAGE_CHARS),
  }),
  documentIds: z.array(z.string().uuid()).max(5).default([]),
  regenerate: z.boolean().default(false),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

/** A single question may be at most this many tokens (~1,600 characters): context budget, P2-S3-A12. */
export const MAX_QUESTION_TOKENS = 400;

export const LIMIT_CODES = [
  "GUEST_TURN_LIMIT",
  "GUEST_DAILY_LIMIT",
  "RATE_LIMITED",
  "DAILY_MESSAGE_LIMIT",
  "MODEL_CAPACITY",
  "MESSAGE_TOO_LONG",
  "CONVERSATION_BUSY",
] as const;

const usage = z.object({ used: z.number().int().min(0), limit: z.number().int().positive(), resetAt: z.string().nullable() });

export const LimitsResponseSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("guest"),
    turnsPerThread: z.number().int().positive(),
    threads: usage,
  }),
  z.object({
    kind: z.literal("user"),
    messages: usage,
    uploads: z.object({ used: z.number().int().min(0), limit: z.number().int().positive(), nextSlotAt: z.string().nullable() }),
    active: z.object({ used: z.number().int().min(0), limit: z.number().int().positive() }),
  }),
]);
export type LimitsResponse = z.infer<typeof LimitsResponseSchema>;

/** Transient stream part telling the client which conversation / guest thread the turn belongs to. */
export interface ThreadInfo {
  kind: "conversation" | "guest";
  id: string;
  title?: string;
}
