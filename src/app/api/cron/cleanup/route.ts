import { timingSafeEqual } from "node:crypto";

import { and, eq, inArray, isNull, lt, ne, or } from "drizzle-orm";

import { documentProcessingJobs, documents, modelUsage, uploadEvents } from "@/db/schema";
import { sweepStaleStreaming } from "@/server/chat/persistence";
import { getDb } from "@/server/db";
import { env } from "@/server/env";
import { jsonError, route } from "@/server/http";
import { releaseExpiredReservations } from "@/server/limits/quotas";
import { logger } from "@/server/log";
import { kickProcessing } from "@/server/rag/ingest/kick";

export const runtime = "nodejs";

function authorized(req: Request) {
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${env.CRON_SECRET ?? ""}`);
  return Boolean(env.CRON_SECRET) && given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Daily (vercel.json): stale `streaming` answers → error; prune metrics older than 30 days;
 * release abandoned upload reservations; drop upload events older than 30 days (they no longer
 * count towards the weekly quota); restart unfinished ingestion whose lease ran out, e.g. a book
 * paused on the embedding provider's daily quota while nobody had the Library open. It runs at
 * 09:00 UTC, after Gemini's daily reset (midnight Pacific time).
 */
export const GET = route(async (req: Request) => {
  if (!authorized(req)) return jsonError(401, "UNAUTHORIZED", "Not allowed.");
  const db = await getDb();
  const swept = await sweepStaleStreaming(db);
  const cutoff = new Date(Date.now() - 30 * 86_400_000);
  const pruned = (await db.delete(modelUsage).where(lt(modelUsage.createdAt, cutoff)).returning({ id: modelUsage.id })).length;
  const released = (await releaseExpiredReservations(db, null)).length;
  const oldEvents = (await db.delete(uploadEvents).where(lt(uploadEvents.createdAt, cutoff)).returning({ id: uploadEvents.id })).length;
  const stalled = await db
    .select({ id: documentProcessingJobs.documentId })
    .from(documentProcessingJobs)
    .innerJoin(documents, eq(documents.id, documentProcessingJobs.documentId))
    .where(
      and(
        inArray(documents.status, ["queued", "processing"]),
        ne(documentProcessingJobs.stage, "done"),
        or(isNull(documentProcessingJobs.leaseUntil), lt(documentProcessingJobs.leaseUntil, new Date())),
      ),
    )
    .limit(10);
  for (const { id } of stalled) kickProcessing(id);
  logger.info("cron.cleanup", { swept, pruned, released, oldEvents, resumed: stalled.length });
  return Response.json({ swept, pruned, released, oldEvents, resumed: stalled.length });
});
