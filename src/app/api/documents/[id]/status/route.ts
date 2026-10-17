import { z } from "zod";

import { requireUser } from "@/server/auth/require-user";
import { getDb } from "@/server/db";
import { getOwnedDocument, toSummary } from "@/server/db/queries/documents";
import { route } from "@/server/http";
import { kickProcessing } from "@/server/rag/ingest/kick";
import { documentNotFound } from "@/server/rag/upload";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Processing status for the Library card (polled). Also the watchdog: a queued/processing job
 * whose lease has expired (a lost continuation, a crashed slice) is started again (P3-S3-A14).
 */
export const GET = route(async (_req: Request, ctx: Ctx) => {
  const { userId } = await requireUser();
  const id = z.string().uuid().safeParse((await ctx.params).id);
  const row = id.success ? await getOwnedDocument(await getDb(), userId, id.data) : null;
  if (!row) throw documentNotFound();
  const { doc, job } = row;
  const stalled =
    (doc.status === "queued" || doc.status === "processing") &&
    job &&
    job.stage !== "done" &&
    (!job.leaseUntil || job.leaseUntil.getTime() < Date.now());
  if (stalled) kickProcessing(doc.id);
  return Response.json({ ...toSummary(doc, job), restarted: Boolean(stalled) });
});
