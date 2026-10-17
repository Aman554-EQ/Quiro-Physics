import "server-only";

import { and, asc, count, eq, gt } from "drizzle-orm";

import { messages } from "@/db/schema";
import type { Db } from "@/server/db";
import { env } from "@/server/env";

const DAY_MS = 86_400_000;

/** Messages the user sent in the rolling last 24 h, and when the oldest of them stops counting. */
export async function dailyMessageUsage(db: Db, userId: string, now = new Date()) {
  const since = new Date(now.getTime() - DAY_MS);
  const where = and(eq(messages.userId, userId), eq(messages.role, "user"), gt(messages.createdAt, since));
  const [{ n } = { n: 0 }] = await db.select({ n: count() }).from(messages).where(where);
  let resetAt: string | null = null;
  if (n >= env.USER_MAX_MESSAGES_PER_DAY) {
    const [oldest] = await db
      .select({ at: messages.createdAt })
      .from(messages)
      .where(where)
      .orderBy(asc(messages.createdAt))
      .limit(1);
    if (oldest) resetAt = new Date(oldest.at.getTime() + DAY_MS).toISOString();
  }
  return { used: n, limit: env.USER_MAX_MESSAGES_PER_DAY, resetAt };
}
