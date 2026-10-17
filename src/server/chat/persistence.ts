import "server-only";

import { and, desc, eq, lt, sql } from "drizzle-orm";

import { conversations, messages, modelUsage } from "@/db/schema";
import type { Db } from "@/server/db";
import { AppError, NotFoundError } from "@/server/http";
import type { MessagePart } from "@/shared/ui-message";

/**
 * Message lifecycle (STREAMING.md §4, P2-S4). Before streaming, one transaction inserts the user
 * message (seq n) and an assistant placeholder (seq n+1, status=streaming). What streams is what
 * gets saved: complete / cancelled (partial text) / error (partial text).
 */
export const STALE_STREAMING_MS = 5 * 60_000;

export interface TurnStart {
  conversationId: string;
  title: string;
  isNewConversation: boolean;
  userMessage: { id: string; seq: number; text: string };
  assistantId: string;
  assistantSeq: number;
  regenerated: boolean;
}

const isUniqueViolation = (err: unknown) => {
  let e: unknown = err;
  for (let i = 0; i < 4 && e; i++) {
    if ((e as { code?: string }).code === "23505") return true;
    e = (e as { cause?: unknown }).cause;
  }
  return false;
};

const busy = () =>
  new AppError(409, "CONVERSATION_BUSY", "An answer is still being written in this chat. Wait for it or stop it first.");

export async function beginUserTurn(
  db: Db,
  opts: { userId: string; conversationId?: string; text: string; regenerate: boolean; now?: Date },
): Promise<TurnStart> {
  const now = opts.now ?? new Date();
  try {
    return await db.transaction(async (tx) => {
      let conversation: { id: string; title: string } | undefined;
      let isNewConversation = false;
      if (opts.conversationId) {
        // Row lock: concurrent sends to the same conversation are serialised here (P2-S4-A09).
        const rows = await tx
          .select({ id: conversations.id, title: conversations.title })
          .from(conversations)
          .where(and(eq(conversations.id, opts.conversationId), eq(conversations.userId, opts.userId)))
          .for("update");
        conversation = rows[0];
        if (!conversation) throw new NotFoundError();
      } else {
        if (opts.regenerate) throw new AppError(400, "INVALID_REQUEST", "Nothing to regenerate yet.");
        const [row] = await tx
          .insert(conversations)
          .values({ userId: opts.userId, title: "New chat" })
          .returning({ id: conversations.id, title: conversations.title });
        conversation = row!;
        isNewConversation = true;
      }

      const fresh = new Date(now.getTime() - STALE_STREAMING_MS);
      const [inFlight] = await tx
        .select({ id: messages.id })
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, conversation.id),
            eq(messages.status, "streaming"),
            sql`${messages.updatedAt} > ${fresh.toISOString()}::timestamptz`,
          ),
        )
        .limit(1);
      if (inFlight) throw busy();

      if (opts.regenerate) {
        const [lastAssistant] = await tx
          .select({ id: messages.id, seq: messages.seq })
          .from(messages)
          .where(and(eq(messages.conversationId, conversation.id), eq(messages.role, "assistant")))
          .orderBy(desc(messages.seq))
          .limit(1);
        const [lastUser] = lastAssistant
          ? await tx
              .select({ id: messages.id, seq: messages.seq, content: messages.content })
              .from(messages)
              .where(
                and(
                  eq(messages.conversationId, conversation.id),
                  eq(messages.role, "user"),
                  lt(messages.seq, lastAssistant.seq),
                ),
              )
              .orderBy(desc(messages.seq))
              .limit(1)
          : [];
        if (!lastAssistant || !lastUser) throw new AppError(400, "INVALID_REQUEST", "Nothing to regenerate yet.");
        // Same row, same seq: the old answer is replaced, never duplicated (P2-S4-A08).
        await tx
          .update(messages)
          .set({
            content: "",
            parts: [],
            status: "streaming",
            model: null,
            fallbackUsed: false,
            promptTokens: null,
            completionTokens: null,
            reasoningTokens: null,
            latencyMs: null,
            firstTokenMs: null,
          })
          .where(eq(messages.id, lastAssistant.id));
        await tx.update(conversations).set({ lastMessageAt: now }).where(eq(conversations.id, conversation.id));
        return {
          conversationId: conversation.id,
          title: conversation.title,
          isNewConversation,
          userMessage: { id: lastUser.id, seq: lastUser.seq, text: lastUser.content },
          assistantId: lastAssistant.id,
          assistantSeq: lastAssistant.seq,
          regenerated: true,
        };
      }

      const [{ maxSeq } = { maxSeq: 0 }] = await tx
        .select({ maxSeq: sql<number>`coalesce(max(${messages.seq}), 0)::int` })
        .from(messages)
        .where(eq(messages.conversationId, conversation.id));
      const seq = maxSeq + 1;
      const [user] = await tx
        .insert(messages)
        .values({
          conversationId: conversation.id,
          userId: opts.userId,
          seq,
          role: "user",
          content: opts.text,
          parts: [{ type: "text", text: opts.text }],
          status: "complete",
          createdAt: now,
        })
        .returning({ id: messages.id });
      const [assistant] = await tx
        .insert(messages)
        .values({ conversationId: conversation.id, userId: opts.userId, seq: seq + 1, role: "assistant", status: "streaming" })
        .returning({ id: messages.id });
      await tx
        .update(conversations)
        .set({ messageCount: sql`${conversations.messageCount} + 2`, lastMessageAt: now })
        .where(eq(conversations.id, conversation.id));
      return {
        conversationId: conversation.id,
        title: conversation.title,
        isNewConversation,
        userMessage: { id: user!.id, seq, text: opts.text },
        assistantId: assistant!.id,
        assistantSeq: seq + 1,
        regenerated: false,
      };
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw busy();
    throw err;
  }
}

export interface AssistantResult {
  status: "complete" | "cancelled" | "error";
  content: string;
  parts: MessagePart[];
  queryType?: "concept" | "numerical" | "derivation" | "textbook_lookup" | "follow_up" | "mixed" | "off_topic" | "greeting";
  model?: string | null;
  fallbackUsed?: boolean;
  promptTokens?: number | null;
  completionTokens?: number | null;
  reasoningTokens?: number | null;
  latencyMs?: number | null;
  firstTokenMs?: number | null;
}

export async function finishAssistant(db: Db, assistantId: string, r: AssistantResult) {
  await db
    .update(messages)
    .set({
      status: r.status,
      content: r.content,
      parts: r.parts,
      queryType: r.queryType ?? null,
      model: r.model ?? null,
      fallbackUsed: r.fallbackUsed ?? false,
      promptTokens: r.promptTokens ?? null,
      completionTokens: r.completionTokens ?? null,
      reasoningTokens: r.reasoningTokens ?? null,
      latencyMs: r.latencyMs ?? null,
      firstTokenMs: r.firstTokenMs ?? null,
    })
    .where(eq(messages.id, assistantId));
}

/**
 * Crash safety: a function that died mid-stream leaves its row `streaming`. Rows older than 5 min
 * become `error` (partial text kept). Run by the daily cron and lazily when a chat is opened.
 */
export async function sweepStaleStreaming(db: Db, opts: { conversationId?: string; now?: Date } = {}) {
  const cutoff = new Date((opts.now ?? new Date()).getTime() - STALE_STREAMING_MS);
  const rows = await db
    .update(messages)
    .set({ status: "error" })
    .where(
      and(
        eq(messages.status, "streaming"),
        lt(messages.updatedAt, cutoff),
        opts.conversationId ? eq(messages.conversationId, opts.conversationId) : undefined,
      ),
    )
    .returning({ id: messages.id });
  return rows.length;
}

/** Every message of a conversation, oldest first (for the chat page). */
export async function listMessages(db: Db, userId: string, conversationId: string, limit = 200) {
  const rows = await db
    .select()
    .from(messages)
    .where(and(eq(messages.conversationId, conversationId), eq(messages.userId, userId)))
    .orderBy(desc(messages.seq))
    .limit(limit);
  return rows.reverse();
}

export async function recordUsage(db: Db, row: typeof modelUsage.$inferInsert) {
  await db.insert(modelUsage).values(row);
}

