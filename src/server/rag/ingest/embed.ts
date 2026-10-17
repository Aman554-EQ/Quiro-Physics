import "server-only";

import { and, asc, count, eq, isNotNull, isNull, sql } from "drizzle-orm";

import { documentChunks, documentProcessingJobs } from "@/db/schema";

import { EmbeddingRateLimitError, GEMINI_BATCH, requestWindow } from "../embeddings";

import type { StageContext, StageResult } from "./context";

/**
 * Embed stage (RAG_PIPELINE.md §4): chunks `where embedding is null`, in chunk order, 32 at a time.
 * - Paced: with a per-minute limit (Gemini free tier: 100 passages a minute) each batch waits until
 *   it fits the last minute's budget instead of running into 429s.
 * - On 429 it waits the delay Gemini asks for and retries, unless that would pass the slice
 *   deadline: then it stops with the work saved (P3-S4-A10/A11). A used-up daily quota pauses the
 *   job until the quota resets (`waitUntil`): nothing runs in the meantime.
 * - One UPDATE per batch (a round trip per passage made Neon the second bottleneck).
 */
export async function embedBatch(ctx: StageContext): Promise<StageResult> {
  const { db, doc } = ctx;
  const limit = ctx.embeddings.requestsPerMinute;
  const window = limit ? requestWindow(ctx.embeddings.modelId, limit) : null;
  const [{ n: initial } = { n: 0 }] = await db
    .select({ n: count() })
    .from(documentChunks)
    .where(and(eq(documentChunks.documentId, doc.id), isNotNull(documentChunks.embedding)));
  let embedded = initial;

  for (;;) {
    if (ctx.now() >= ctx.deadline) return { done: false, yield: true };
    const pending = await db
      .select({ id: documentChunks.id, text: documentChunks.searchText })
      .from(documentChunks)
      .where(and(eq(documentChunks.documentId, doc.id), isNull(documentChunks.embedding)))
      .orderBy(asc(documentChunks.chunkIndex))
      .limit(window ? Math.min(GEMINI_BATCH, window.perMinute) : GEMINI_BATCH);
    if (pending.length === 0) return { done: true };

    if (window) {
      const wait = window.waitMs(pending.length, ctx.now());
      if (wait > 0) {
        if (ctx.now() + wait >= ctx.deadline) return { done: false, yield: true };
        await ctx.sleep(wait);
      }
    }

    let vectors: number[][];
    try {
      vectors = await ctx.embeddings.embedDocuments(pending.map((p) => p.text));
    } catch (err) {
      if (err instanceof EmbeddingRateLimitError) {
        window?.block(ctx.now() + err.retryAfterMs);
        if (err.daily) return { done: false, yield: true, waitUntil: ctx.now() + err.retryAfterMs, waitReason: "daily_quota" };
        if (ctx.now() + err.retryAfterMs >= ctx.deadline)
          return { done: false, yield: true, waitUntil: ctx.now() + err.retryAfterMs, waitReason: "rate_limit" };
        await ctx.sleep(err.retryAfterMs);
        continue;
      }
      throw err;
    }
    const rows = pending.map((p, i) => sql`(${p.id}::uuid, ${`[${vectors[i]!.join(",")}]`}::halfvec(768))`);
    await db.execute(sql`
      update ${documentChunks} as c set embedding = v.e
      from (values ${sql.join(rows, sql`, `)}) as v(id, e)
      where c.id = v.id and c.embedding is null`);
    window?.record(pending.length, ctx.now());
    embedded += pending.length;
    await db
      .update(documentProcessingJobs)
      .set({
        cursor: embedded,
        // Progress again: a quota pause is over (other errors stay for debugging).
        lastError: sql`case when ${documentProcessingJobs.lastError} like 'quota_wait%' then null else ${documentProcessingJobs.lastError} end`,
      })
      .where(eq(documentProcessingJobs.documentId, doc.id));
  }
}
