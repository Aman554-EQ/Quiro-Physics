import "server-only";

import { BaseChatMessageHistory } from "@langchain/core/chat_history";
import { AIMessage, HumanMessage, type BaseMessage } from "@langchain/core/messages";
import { and, desc, eq, inArray } from "drizzle-orm";

import { messages } from "@/db/schema";
import type { Db } from "@/server/db";

import { CONTEXT_BUDGET, contextText, type HistoryMessage } from "./context";

/**
 * LangChain view of a conversation's recent turns (MEMORY_SYSTEM.md §5). Read-only: persistence
 * belongs to the chat lifecycle, so `addMessage` is a no-op. Keeps memory swappable for LangChain
 * chains while the app itself uses `loadHistory`.
 */
export class DrizzleChatMessageHistory extends BaseChatMessageHistory {
  lc_namespace = ["quiro", "memory"];

  constructor(
    private readonly opts: { db: Db; userId: string; conversationId: string; window?: number },
  ) {
    super();
  }

  async getMessages(): Promise<BaseMessage[]> {
    const rows = await loadHistory(this.opts.db, this.opts.userId, this.opts.conversationId, {
      limit: this.opts.window ?? CONTEXT_BUDGET.maxRecentMessages,
    });
    return rows.map((m) => (m.role === "user" ? new HumanMessage(contextText(m)) : new AIMessage(contextText(m))));
  }

  async addMessage(_message: BaseMessage): Promise<void> {}
  async addUserMessage(_message: string): Promise<void> {}
  async addAIMessage(_message: string): Promise<void> {}
  async clear(): Promise<void> {}
}

/**
 * Finished turns of a conversation (complete or cancelled: a stopped answer is still context),
 * oldest first. Optionally only messages before `beforeSeq`.
 */
export async function loadHistory(
  db: Db,
  userId: string,
  conversationId: string,
  opts: { limit?: number; beforeSeq?: number } = {},
): Promise<HistoryMessage[]> {
  const rows = await db
    .select({ seq: messages.seq, role: messages.role, content: messages.content, parts: messages.parts })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        eq(messages.userId, userId),
        inArray(messages.status, ["complete", "cancelled"]),
      ),
    )
    .orderBy(desc(messages.seq))
    .limit(opts.limit ?? 40);
  return rows
    .filter((r) => (opts.beforeSeq === undefined || r.seq < opts.beforeSeq) && r.role !== "system")
    .reverse()
    .map((r) => ({ seq: r.seq, role: r.role as "user" | "assistant", content: r.content, parts: r.parts }));
}
