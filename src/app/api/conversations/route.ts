import { z } from "zod";

import { requireUser } from "@/server/auth/require-user";
import { getDb } from "@/server/db";
import { createConversation, deleteAllConversations, listConversations } from "@/server/db/queries/conversations";
import { route } from "@/server/http";

export const runtime = "nodejs";

/** List (pinned first, then recent), 30 per page, optional title search. */
export const GET = route(async (req: Request) => {
  const { userId } = await requireUser();
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.slice(0, 100) ?? undefined;
  const page = await listConversations(await getDb(), userId, { q, cursor: url.searchParams.get("cursor") });
  return Response.json(page);
});

const CreateSchema = z.object({ title: z.string().trim().min(1).max(120).optional() });

export const POST = route(async (req: Request) => {
  const { userId } = await requireUser();
  const body = CreateSchema.parse(await req.json().catch(() => ({})));
  const row = await createConversation(await getDb(), userId, body.title);
  return Response.json({ id: row.id, title: row.title }, { status: 201 });
});

const DeleteAllSchema = z.object({ confirm: z.literal("DELETE") });

/** Delete ALL of the caller's history. Requires `{ confirm: "DELETE" }`. */
export const DELETE = route(async (req: Request) => {
  const { userId } = await requireUser();
  DeleteAllSchema.parse(await req.json().catch(() => ({})));
  const deleted = await deleteAllConversations(await getDb(), userId);
  return Response.json({ deleted });
});
