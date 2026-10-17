import { timingSafeEqual } from "node:crypto";

import { lt } from "drizzle-orm";

import { modelUsage } from "@/db/schema";
import { sweepStaleStreaming } from "@/server/chat/persistence";
import { getDb } from "@/server/db";
import { env } from "@/server/env";
import { jsonError, route } from "@/server/http";
import { logger } from "@/server/log";

export const runtime = "nodejs";

function authorized(req: Request) {
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${env.CRON_SECRET ?? ""}`);
  return Boolean(env.CRON_SECRET) && given.length === expected.length && timingSafeEqual(given, expected);
}

/** Daily (vercel.json): stale `streaming` answers → error; prune metrics older than 30 days. */
export const GET = route(async (req: Request) => {
  if (!authorized(req)) return jsonError(401, "UNAUTHORIZED", "Not allowed.");
  const db = await getDb();
  const swept = await sweepStaleStreaming(db);
  const cutoff = new Date(Date.now() - 30 * 86_400_000);
  const pruned = (await db.delete(modelUsage).where(lt(modelUsage.createdAt, cutoff)).returning({ id: modelUsage.id })).length;
  logger.info("cron.cleanup", { swept, pruned });
  return Response.json({ swept, pruned });
});
