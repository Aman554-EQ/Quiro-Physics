import "server-only";

import { and, asc, count, eq, gt, inArray, lt, sql } from "drizzle-orm";

import { documents, uploadEvents } from "@/db/schema";
import type { Db } from "@/server/db";
import { env } from "@/server/env";
import { AppError } from "@/server/http";
import type { KV } from "@/server/kv";
import { EMBEDDING_DIM, getEmbeddings } from "@/server/rag/embeddings";
import { ACTIVE_STATUSES } from "@/shared/documents";

/**
 * Upload quotas (LIMITS_AND_QUOTAS.md §2):
 * - weekly: `upload_events` in the last 7 days + live reservations (deleting a document keeps its event);
 * - active: documents in reserved/queued/processing/ready (deleting frees a slot at once).
 * Both are checked under a per-user advisory lock, so parallel uploads can't exceed either.
 */
export const WEEK_MS = 7 * 86_400_000;
export const RESERVATION_TTL_MS = 30 * 60_000;
/** Free Neon plan: 0.5 GB; uploads stop at 85% (DATABASE_SCHEMA.md §6). */
export const STORAGE_LIMIT_BYTES = 0.5 * 1024 ** 3;
export const STORAGE_STOP_FRACTION = 0.85;
export const PARSER_VERSION = "physics-parser@2";

export class QuotaError extends AppError {
  constructor(
    readonly kind: "weekly" | "active" | "storage",
    nextSlotAt?: Date,
  ) {
    super(
      kind === "storage" ? 503 : 429,
      kind === "weekly" ? "WEEKLY_UPLOAD_LIMIT" : kind === "active" ? "ACTIVE_DOCUMENT_LIMIT" : "STORAGE_FULL",
      kind === "weekly"
        ? `You've uploaded ${env.UPLOAD_QUOTA_PER_WEEK} PDFs in the last 7 days. Your next upload slot opens when the oldest one is a week old.`
        : kind === "active"
          ? `You have ${env.MAX_ACTIVE_DOCUMENTS} active PDFs. Delete one to add another.`
          : "Uploads are paused because storage is almost full. Please try again later.",
      nextSlotAt?.toISOString(),
    );
    this.name = "QuotaError";
    this.nextSlotAt = nextSlotAt ?? null;
  }
  readonly nextSlotAt: Date | null;
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Q = Db | Tx;

/** Abandoned uploads (no /complete within 30 min) are released lazily, here and by the cron. */
export async function releaseExpiredReservations(q: Q, userId: string | null, now = new Date()) {
  const cutoff = new Date(now.getTime() - RESERVATION_TTL_MS);
  const rows = await q
    .delete(documents)
    .where(
      and(
        eq(documents.status, "reserved"),
        lt(documents.reservedAt, cutoff),
        userId ? eq(documents.userId, userId) : undefined,
      ),
    )
    .returning({ id: documents.id, blobPathname: documents.blobPathname });
  return rows;
}

async function weeklyEvents(q: Q, userId: string, now: Date) {
  const since = new Date(now.getTime() - WEEK_MS);
  return q
    .select({ createdAt: uploadEvents.createdAt })
    .from(uploadEvents)
    .where(and(eq(uploadEvents.userId, userId), gt(uploadEvents.createdAt, since)))
    .orderBy(asc(uploadEvents.createdAt));
}

async function countWhere(q: Q, userId: string, statuses: (typeof ACTIVE_STATUSES)[number][]) {
  const [row] = await q
    .select({ n: count() })
    .from(documents)
    .where(and(eq(documents.userId, userId), inArray(documents.status, statuses)));
  return row?.n ?? 0;
}

export interface UploadUsage {
  uploads: { used: number; limit: number; nextSlotAt: string | null };
  active: { used: number; limit: number };
}

/** Weekly and active usage. `nextSlotAt` is only set when the weekly quota is full (P3-S1-A15). */
export async function uploadUsage(q: Q, userId: string, now = new Date()): Promise<UploadUsage> {
  const events = await weeklyEvents(q, userId, now);
  const reservations = await countWhere(q, userId, ["reserved"]);
  const used = events.length + reservations;
  const limit = env.UPLOAD_QUOTA_PER_WEEK;
  let nextSlotAt: string | null = null;
  if (used >= limit) {
    // The oldest counted event frees its slot 7 days after it was created; reservations free
    // theirs within 30 minutes if abandoned.
    const oldest = events[0]?.createdAt;
    nextSlotAt = new Date(oldest ? oldest.getTime() + WEEK_MS : now.getTime() + RESERVATION_TTL_MS).toISOString();
  }
  return {
    uploads: { used, limit, nextSlotAt },
    active: { used: await countWhere(q, userId, ACTIVE_STATUSES), limit: env.MAX_ACTIVE_DOCUMENTS },
  };
}

/** Storage guard (P3-S1-A14): uploads stop at 85% of the plan. */
export function storageAllows(sizeBytes: number, limitBytes = STORAGE_LIMIT_BYTES) {
  return sizeBytes < limitBytes * STORAGE_STOP_FRACTION;
}

const STORAGE_CACHE_KEY = "storage:db_size";

/** `pg_database_size`, cached for 10 minutes. */
export async function assertStorage(db: Db, kv: KV) {
  let size = await kv.get<number>(STORAGE_CACHE_KEY);
  if (typeof size !== "number") {
    const rows = await db.execute<{ s: string | number }>(sql`select pg_database_size(current_database()) as s`);
    const first = (Array.isArray(rows) ? rows[0] : (rows as { rows: { s: string | number }[] }).rows[0]) as
      | { s: string | number }
      | undefined;
    size = Number(first?.s ?? 0);
    await kv.set(STORAGE_CACHE_KEY, size, { ex: 600 });
  }
  if (!storageAllows(size)) throw new QuotaError("storage");
}

export interface ReserveInput {
  filename: string;
  sizeBytes: number;
  now?: Date;
}

const titleFrom = (filename: string) =>
  filename.replace(/\.pdf$/i, "").replace(/[_]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) || "Untitled PDF";

/** Reserve an upload slot: a `documents` row in status `reserved` (IMPLEMENTATION.md Step 3.1). */
export async function reserveUpload(db: Db, userId: string, input: ReserveInput) {
  const now = input.now ?? new Date();
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${userId}, 0))`);
    await releaseExpiredReservations(tx, userId, now);
    const usage = await uploadUsage(tx, userId, now);
    if (usage.uploads.used >= usage.uploads.limit)
      throw new QuotaError("weekly", usage.uploads.nextSlotAt ? new Date(usage.uploads.nextSlotAt) : undefined);
    if (usage.active.used >= usage.active.limit) throw new QuotaError("active");
    const [doc] = await tx
      .insert(documents)
      .values({
        userId,
        title: titleFrom(input.filename),
        originalFilename: input.filename.slice(0, 255),
        sizeBytes: input.sizeBytes,
        status: "reserved",
        parserVersion: PARSER_VERSION,
        embeddingModel: getEmbeddings().modelId,
        embeddingDim: EMBEDDING_DIM,
        reservedAt: now,
        createdAt: now,
      })
      .returning();
    return doc!;
  });
}

/** Release one reservation (a failed /complete): the slot is free again, nothing is counted. */
export async function releaseReservation(db: Db, userId: string, documentId: string) {
  await db
    .delete(documents)
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId), eq(documents.status, "reserved")));
}

/** Processing failed through our fault (crash, timeout): give the weekly slot back. */
export async function refundUpload(q: Q, documentId: string) {
  await q.delete(uploadEvents).where(eq(uploadEvents.documentId, documentId));
}
