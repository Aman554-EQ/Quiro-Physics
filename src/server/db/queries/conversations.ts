import "server-only";

import { and, desc, eq, ilike, sql } from "drizzle-orm";

import type { Db } from "@/server/db";
import { conversations } from "@/db/schema";

/**
 * All conversation access. Every function takes the caller's internal `userId` and filters on it,
 * so one user can never read or change another's rows (SECURITY S3, P2-S2-A12, P2-S6-A05).
 */
export const PAGE_SIZE = 30;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: string) => UUID_RE.test(v);

export interface ConversationSummary {
  id: string;
  title: string;
  pinned: boolean;
  messageCount: number;
  lastMessageAt: string;
}

const summaryColumns = {
  id: conversations.id,
  title: conversations.title,
  pinned: conversations.pinned,
  messageCount: conversations.messageCount,
  lastMessageAt: conversations.lastMessageAt,
};

interface Cursor {
  p: boolean;
  t: string;
  i: string;
}
const encodeCursor = (c: Cursor) => Buffer.from(JSON.stringify(c)).toString("base64url");
function decodeCursor(raw: string | null | undefined): Cursor | null {
  if (!raw) return null;
  try {
    const c = JSON.parse(Buffer.from(raw, "base64url").toString()) as Cursor;
    return typeof c.p === "boolean" && !Number.isNaN(Date.parse(c.t)) && isUuid(c.i) ? c : null;
  } catch {
    return null;
  }
}

const escapeLike = (q: string) => q.replace(/[\\%_]/g, (m) => `\\${m}`);

/** Pinned first, then most recent; keyset-paginated (30 per page); optional title search. */
export async function listConversations(
  db: Db,
  userId: string,
  opts: { q?: string; cursor?: string | null; limit?: number } = {},
) {
  const limit = opts.limit ?? PAGE_SIZE;
  const cursor = decodeCursor(opts.cursor);
  const where = [eq(conversations.userId, userId)];
  if (opts.q?.trim()) where.push(ilike(conversations.title, `%${escapeLike(opts.q.trim())}%`));
  if (cursor)
    where.push(
      sql`(${conversations.pinned}, ${conversations.lastMessageAt}, ${conversations.id}) < (${cursor.p}, ${cursor.t}::timestamptz, ${cursor.i}::uuid)`,
    );
  const rows = await db
    .select(summaryColumns)
    .from(conversations)
    .where(and(...where))
    .orderBy(desc(conversations.pinned), desc(conversations.lastMessageAt), desc(conversations.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    items: page.map((r): ConversationSummary => ({ ...r, lastMessageAt: r.lastMessageAt.toISOString() })),
    nextCursor:
      rows.length > limit && last
        ? encodeCursor({ p: last.pinned, t: last.lastMessageAt.toISOString(), i: last.id })
        : null,
  };
}

export async function getConversation(db: Db, userId: string, id: string) {
  if (!isUuid(id)) return null;
  const [row] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
  return row ?? null;
}

export async function createConversation(db: Db, userId: string, title = "New chat") {
  const [row] = await db.insert(conversations).values({ userId, title }).returning();
  return row!;
}

/** User rename: marks the title as user-set so automatic titles never overwrite it (P2-S4-A10). */
export async function renameConversation(db: Db, userId: string, id: string, title: string) {
  if (!isUuid(id)) return null;
  const [row] = await db
    .update(conversations)
    .set({ title, titleSetByUser: true })
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
    .returning(summaryColumns);
  return row ?? null;
}

export async function setPinned(db: Db, userId: string, id: string, pinned: boolean) {
  if (!isUuid(id)) return null;
  const [row] = await db
    .update(conversations)
    .set({ pinned })
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
    .returning(summaryColumns);
  return row ?? null;
}

/** Automatic title (title model): only while the user hasn't renamed the chat. */
export async function setAutoTitle(db: Db, userId: string, id: string, title: string) {
  const rows = await db
    .update(conversations)
    .set({ title })
    .where(
      and(eq(conversations.id, id), eq(conversations.userId, userId), eq(conversations.titleSetByUser, false)),
    )
    .returning({ id: conversations.id });
  return rows.length > 0;
}

/** Hard delete: messages, memory, citations and document links cascade (DATABASE_SCHEMA §2). */
export async function deleteConversation(db: Db, userId: string, id: string) {
  if (!isUuid(id)) return false;
  const rows = await db
    .delete(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
    .returning({ id: conversations.id });
  return rows.length > 0;
}

export async function deleteAllConversations(db: Db, userId: string) {
  const rows = await db
    .delete(conversations)
    .where(eq(conversations.userId, userId))
    .returning({ id: conversations.id });
  return rows.length;
}
