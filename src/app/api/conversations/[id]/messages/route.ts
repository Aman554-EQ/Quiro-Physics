import { and, desc, eq, lt } from "drizzle-orm";

import { messages } from "@/db/schema";
import { requireUser } from "@/server/auth/require-user";
import { rowToChatMessage, withSourceStatus } from "@/server/chat/hydrate";
import { getDb } from "@/server/db";
import { getConversation } from "@/server/db/queries/conversations";
import { NotFoundError, route } from "@/server/http";

export const runtime = "nodejs";

const PAGE = 50;

/** Paged messages, newest page first: `?before=<seq>` loads older ones (API.md). */
export const GET = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { userId } = await requireUser();
  const { id } = await ctx.params;
  const db = await getDb();
  if (!(await getConversation(db, userId, id))) throw new NotFoundError();
  const before = Number(new URL(req.url).searchParams.get("before"));
  const rows = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, id),
        eq(messages.userId, userId),
        Number.isInteger(before) && before > 0 ? lt(messages.seq, before) : undefined,
      ),
    )
    .orderBy(desc(messages.seq))
    .limit(PAGE + 1);
  const page = rows.slice(0, PAGE).reverse();
  return Response.json({
    messages: (await withSourceStatus(db, userId, page.map(rowToChatMessage))).map((m, i) => ({ ...m, seq: page[i]!.seq })),
    hasMore: rows.length > PAGE,
  });
});
