import "server-only";

import { and, eq, isNull, lt, or, sql } from "drizzle-orm";

import { documentProcessingJobs, documents, type JobRow } from "@/db/schema";
import type { Db } from "@/server/db";
import { refundUpload } from "@/server/limits/quotas";
import { logger } from "@/server/log";
import type { BlobStore } from "@/server/storage/blob";
import type { JobStage } from "@/shared/documents";

import type { PhysicsEmbeddings } from "../embeddings";

import { chunkBatch } from "./chunk";
import { isFileFault, QUOTA_WAIT_PREFIX, type QuotaWait, type StageContext, type StageResult } from "./context";
import { embedBatch } from "./embed";
import { extractBatch } from "./extract";
import { finalizeBatch } from "./finalize";

/**
 * Resumable ingestion (IMPLEMENTATION.md Step 3.3). One slice:
 *   acquire the lease (UPDATE … WHERE lease expired) → run stage batches until the time budget
 *   (240 s of Vercel Hobby's 300 s) → release → schedule a continuation if not finished.
 * Every stage is cursor-based and idempotent, so a crash or restart at any point only repeats
 * the current batch. Errors: file faults fail at once (no refund); other errors retry, and the
 * 5th failure fails the document and refunds the weekly slot (LIMITS_AND_QUOTAS.md §2).
 */
export const BUDGET_MS = 240_000;
export const LEASE_SECONDS = 280;
export const MAX_ATTEMPTS = 5;

const NEXT: Record<Exclude<JobStage, "done">, JobStage> = {
  extract: "chunk",
  chunk: "embed",
  embed: "finalize",
  finalize: "done",
};

const STAGES: Record<Exclude<JobStage, "done">, (ctx: StageContext) => Promise<StageResult & { backTo?: JobStage }>> = {
  extract: extractBatch,
  chunk: chunkBatch,
  embed: embedBatch,
  finalize: finalizeBatch,
};

export interface RunDeps {
  db: Db;
  blobs: BlobStore;
  embeddings: PhysicsEmbeddings;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  budgetMs?: number;
  /** Called when the slice ended with work left (the default re-invokes the job). */
  continueLater?: (documentId: string) => void;
}

export type RunOutcome = "done" | "continued" | "busy" | "failed" | "stopped" | "retry" | "waiting";

/** Take the job if nobody holds a live lease (P3-S3-A01/A02). */
export async function acquireLease(db: Db, documentId: string, now = Date.now()): Promise<JobRow | null> {
  const until = new Date(now + LEASE_SECONDS * 1000);
  const [job] = await db
    .update(documentProcessingJobs)
    .set({ leaseUntil: until })
    .where(
      and(
        eq(documentProcessingJobs.documentId, documentId),
        sql`${documentProcessingJobs.stage} <> 'done'`,
        or(isNull(documentProcessingJobs.leaseUntil), lt(documentProcessingJobs.leaseUntil, new Date(now))),
      ),
    )
    .returning();
  return job ?? null;
}

export async function releaseLease(db: Db, documentId: string) {
  await db
    .update(documentProcessingJobs)
    .set({ leaseUntil: null })
    .where(eq(documentProcessingJobs.documentId, documentId));
}

/**
 * Pause until the provider's quota resets: the lease is held until then, so neither a
 * continuation nor the status watchdog starts the job early (no busy loop of slices), and the
 * card can say why it is waiting. The first status poll after `until` restarts it.
 */
export async function pauseUntil(db: Db, documentId: string, until: number, reason: QuotaWait) {
  await db
    .update(documentProcessingJobs)
    .set({ leaseUntil: new Date(until), lastError: `${QUOTA_WAIT_PREFIX}${reason}` })
    .where(eq(documentProcessingJobs.documentId, documentId));
}

async function fail(db: Db, documentId: string, message: string, fault: "file" | "system", internal: string) {
  await db.transaction(async (tx) => {
    await tx.update(documents).set({ status: "failed", error: message }).where(eq(documents.id, documentId));
    await tx
      .update(documentProcessingJobs)
      .set({ leaseUntil: null, lastError: internal.slice(0, 500) })
      .where(eq(documentProcessingJobs.documentId, documentId));
    // Our fault (crash, timeouts): the weekly slot comes back. The file's fault: it doesn't.
    if (fault === "system") await refundUpload(tx, documentId);
  });
  logger.warn("ingest.failed", { documentId, fault });
}

export async function runJob(documentId: string, deps: RunDeps): Promise<RunOutcome> {
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const { db } = deps;
  const job = await acquireLease(db, documentId, now());
  if (!job) return "busy";

  const deadline = now() + (deps.budgetMs ?? BUDGET_MS);
  const started = now();
  let stage = job.stage;
  try {
    for (;;) {
      // Deletion wins: a `deleting` (or vanished) document stops at the next check (P3-S3/S6-A10).
      const [doc] = await db.select().from(documents).where(eq(documents.id, documentId));
      if (!doc || doc.status === "deleting" || doc.status === "failed") {
        if (doc) await releaseLease(db, documentId);
        return "stopped";
      }
      if (stage === "done") return "done";
      if (doc.status !== "processing") await db.update(documents).set({ status: "processing" }).where(eq(documents.id, documentId));
      if (now() >= deadline) break;

      const [current] = await db.select().from(documentProcessingJobs).where(eq(documentProcessingJobs.documentId, documentId));
      if (!current) return "stopped";
      const result = await STAGES[stage]({ db, doc, job: { ...current, stage }, blobs: deps.blobs, embeddings: deps.embeddings, deadline, now, sleep });
      if (result.backTo) {
        stage = result.backTo;
        await db.update(documentProcessingJobs).set({ stage }).where(eq(documentProcessingJobs.documentId, documentId));
        continue;
      }
      if (result.done) {
        const next = NEXT[stage];
        // finalize marks the job done inside its own transaction.
        if (stage !== "finalize")
          await db.update(documentProcessingJobs).set({ stage: next, cursor: 0 }).where(eq(documentProcessingJobs.documentId, documentId));
        logger.info("ingest.stage_done", { documentId, stage, ms: now() - started });
        stage = next;
        if (stage === "done") return "done";
        continue;
      }
      if (result.waitUntil && result.waitReason === "daily_quota") {
        await pauseUntil(db, documentId, result.waitUntil, result.waitReason);
        logger.info("ingest.paused", { documentId, stage, reason: result.waitReason, ms: result.waitUntil - now() });
        return "waiting";
      }
      if (result.yield || now() >= deadline) break;
    }
  } catch (err) {
    const fileFault = isFileFault(err);
    const message = fileFault ? (err as Error).message : "Processing failed on our side. Your weekly upload was refunded; please try again.";
    if (fileFault) {
      await fail(db, documentId, message, "file", (err as Error).message);
      return "failed";
    }
    const [row] = await db
      .update(documentProcessingJobs)
      .set({ attempts: sql`${documentProcessingJobs.attempts} + 1`, lastError: String((err as Error)?.message ?? err).slice(0, 500), leaseUntil: null })
      .where(eq(documentProcessingJobs.documentId, documentId))
      .returning({ attempts: documentProcessingJobs.attempts });
    logger.warn("ingest.attempt_failed", { documentId, stage, attempts: row?.attempts ?? null, name: (err as Error)?.name ?? "unknown" });
    if (!row) return "stopped"; // the document was deleted mid-batch
    if (row.attempts >= MAX_ATTEMPTS) {
      await fail(db, documentId, message, "system", String((err as Error)?.message ?? err));
      return "failed";
    }
    deps.continueLater?.(documentId);
    return "retry";
  }

  await releaseLease(db, documentId);
  deps.continueLater?.(documentId);
  return "continued";
}
