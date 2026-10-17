import { z } from "zod";

import { requireUser } from "@/server/auth/require-user";
import { getDb } from "@/server/db";
import {
  deleteConversation,
  getConversation,
  renameConversation,
  setPinned,
} from "@/server/db/queries/conversations";
import { ownedDocumentIds, setConversationDocuments } from "@/server/db/queries/documents";
import { NotFoundError, route } from "@/server/http";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, ctx: Ctx) => {
  const { userId } = await requireUser();
  const { id } = await ctx.params;
  const row = await getConversation(await getDb(), userId, id);
  if (!row) throw new NotFoundError();
  return Response.json({
    id: row.id,
    title: row.title,
    pinned: row.pinned,
    messageCount: row.messageCount,
    lastMessageAt: row.lastMessageAt.toISOString(),
  });
});

const PatchSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    pinned: z.boolean().optional(),
    /** Textbooks for this chat: at most 5, all owned by the caller (P3-S5-A12). */
    documentIds: z.array(z.string().uuid()).max(5).optional(),
  })
  .refine((b) => b.title !== undefined || b.pinned !== undefined || b.documentIds !== undefined, {
    message: "Nothing to update",
  });

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const { userId } = await requireUser();
  const { id } = await ctx.params;
  const body = PatchSchema.parse(await req.json());
  const db = await getDb();
  let row = null;
  if (body.title !== undefined) row = await renameConversation(db, userId, id, body.title);
  if (body.pinned !== undefined) row = await setPinned(db, userId, id, body.pinned);
  if (body.documentIds !== undefined) {
    row = await getConversation(db, userId, id);
    if (!row) throw new NotFoundError();
    const ids = [...new Set(body.documentIds)];
    const owned = await ownedDocumentIds(db, userId, ids);
    // Someone else's (or a deleted) document id: not found, and nothing is changed.
    if (owned.length !== ids.length) throw new NotFoundError("Document");
    await setConversationDocuments(db, id, owned);
  }
  if (!row) throw new NotFoundError();
  return Response.json({ ...row, lastMessageAt: row.lastMessageAt.toISOString() });
});

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const { userId } = await requireUser();
  const { id } = await ctx.params;
  if (!(await deleteConversation(await getDb(), userId, id))) throw new NotFoundError();
  return new Response(null, { status: 204 });
});
