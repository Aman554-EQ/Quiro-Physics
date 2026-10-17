import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { documents } from "@/db/schema";
import { requireUser } from "@/server/auth/require-user";
import { getDb } from "@/server/db";
import { getOwnedDocument, toSummary } from "@/server/db/queries/documents";
import { route } from "@/server/http";
import { deleteDocument } from "@/server/rag/delete";
import { documentNotFound } from "@/server/rag/upload";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };
const Id = z.string().uuid();

export const GET = route(async (_req: Request, ctx: Ctx) => {
  const { userId } = await requireUser();
  const id = Id.safeParse((await ctx.params).id);
  const row = id.success ? await getOwnedDocument(await getDb(), userId, id.data) : null;
  if (!row) throw documentNotFound();
  return Response.json(toSummary(row.doc, row.job));
});

const PatchSchema = z.object({ title: z.string().trim().min(1).max(120) });

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const { userId } = await requireUser();
  const id = Id.safeParse((await ctx.params).id);
  const body = PatchSchema.parse(await req.json());
  const db = await getDb();
  const rows = id.success
    ? await db
        .update(documents)
        .set({ title: body.title })
        .where(and(eq(documents.id, id.data), eq(documents.userId, userId)))
        .returning({ id: documents.id })
    : [];
  if (!rows.length) throw documentNotFound();
  const row = await getOwnedDocument(db, userId, id.data!);
  return Response.json(toSummary(row!.doc, row!.job));
});

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const { userId } = await requireUser();
  const id = Id.safeParse((await ctx.params).id);
  if (!id.success) throw documentNotFound();
  await deleteDocument(await getDb(), userId, id.data);
  return new Response(null, { status: 204 });
});
