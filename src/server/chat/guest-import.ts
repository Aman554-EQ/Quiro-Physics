import "server-only";

import { conversations, messages } from "@/db/schema";
import type { Db } from "@/server/db";
import { NotFoundError } from "@/server/http";
import type { KV } from "@/server/kv";
import { getThread, threadKey, turnsKey } from "@/server/limits/guest-threads";

import { fallbackTitle } from "./title";

/**
 * "Save this chat" after signing in (P2-S5-A14/A15): copy the caller's own guest thread from Redis
 * into a new conversation, in order, then delete the Redis copy. Someone else's thread → 404.
 */
export async function importGuestThread(db: Db, kv: KV, opts: { userId: string; guestId: string | null; threadId: string }) {
  const thread = await getThread(kv, opts.threadId);
  if (!thread || !opts.guestId || thread.guestId !== opts.guestId) throw new NotFoundError("Guest chat");
  const turns = thread.messages.filter((m) => m.text.trim());
  if (turns.length === 0) throw new NotFoundError("Guest chat");
  const firstQuestion = turns.find((m) => m.role === "user")?.text ?? "Guest chat";

  const conversationId = await db.transaction(async (tx) => {
    const [conv] = await tx
      .insert(conversations)
      .values({ userId: opts.userId, title: fallbackTitle(firstQuestion), messageCount: turns.length })
      .returning({ id: conversations.id });
    await tx.insert(messages).values(
      turns.map((m, i) => ({
        conversationId: conv!.id,
        userId: opts.userId,
        seq: i + 1,
        role: m.role,
        content: m.text,
        parts: [{ type: "text" as const, text: m.text }],
        status: m.status ?? "complete",
      })),
    );
    return conv!.id;
  });
  await kv.del(threadKey(opts.threadId), turnsKey(opts.threadId));
  return conversationId;
}
