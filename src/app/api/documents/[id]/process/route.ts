import { timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { getOptionalUser } from "@/server/auth/require-user";
import { getDb } from "@/server/db";
import { getOwnedDocument } from "@/server/db/queries/documents";
import { env } from "@/server/env";
import { jsonError, route } from "@/server/http";
import { kickProcessing, processNow } from "@/server/rag/ingest/kick";
import { documentNotFound } from "@/server/rag/upload";

export const runtime = "nodejs";
/** One ingestion slice is ≤ 240 s; Hobby allows 300 s. */
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

function internalCall(req: Request) {
  const given = Buffer.from(req.headers.get("x-internal-job-secret") ?? "");
  const expected = Buffer.from(env.INTERNAL_JOB_SECRET ?? "");
  return expected.length > 0 && given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Run (or continue) processing. Callers: the previous slice (internal secret: runs the slice in
 * this invocation), or the owner (starts it in the background). Anyone else: 401 (P3-S3-A16).
 */
export const POST = route(async (req: Request, ctx: Ctx) => {
  const id = z.string().uuid().safeParse((await ctx.params).id);
  if (internalCall(req)) {
    if (!id.success) throw documentNotFound();
    const outcome = await processNow(id.data);
    return Response.json({ outcome });
  }
  const user = await getOptionalUser();
  if (!user) return jsonError(401, "UNAUTHORIZED", "Not allowed.");
  const owned = id.success ? await getOwnedDocument(await getDb(), user.userId, id.data) : null;
  if (!owned) throw documentNotFound();
  kickProcessing(owned.doc.id);
  return Response.json({ outcome: "scheduled" });
});
