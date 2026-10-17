import "server-only";

import { createHash } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { documentProcessingJobs, documents, uploadEvents } from "@/db/schema";
import { getOwnedDocument, toSummary } from "@/server/db/queries/documents";
import type { Db } from "@/server/db";
import { env } from "@/server/env";
import { AppError, NotFoundError } from "@/server/http";
import { releaseReservation } from "@/server/limits/quotas";
import { logger } from "@/server/log";
import { isPathFor, type BlobStore } from "@/server/storage/blob";

import { kickProcessing } from "./ingest/kick";

/**
 * `/api/documents/[id]/complete` (IMPLEMENTATION.md Step 3.2). Never trusts the browser: the
 * stored file is checked (exists, size, `%PDF-` magic bytes), hashed (one copy of a textbook per
 * user), then the upload event and the job are created exactly once and processing starts.
 * Any rejection deletes the file and releases the reservation, so nothing is counted.
 */
export const maxPdfBytes = () => env.MAX_PDF_SIZE_MB * 1024 * 1024;

const isUniqueViolation = (err: unknown) => {
  let e: unknown = err;
  for (let i = 0; i < 4 && e; i++) {
    if ((e as { code?: string }).code === "23505") return true;
    e = (e as { cause?: unknown }).cause;
  }
  return false;
};

export const documentNotFound = () => new NotFoundError("Document");

export async function completeUpload(db: Db, blobs: BlobStore, userId: string, documentId: string, pathname: string) {
  const owned = await getOwnedDocument(db, userId, documentId);
  if (!owned) throw documentNotFound();
  const { doc } = owned;
  // Idempotent: a repeated /complete returns the current state (P3-S2-A08).
  if (doc.status !== "reserved") return toSummary(doc, owned.job);

  const reject = async (status: number, code: string, message: string, deleteFile = true) => {
    if (deleteFile) await blobs.del([pathname]).catch(() => undefined);
    await releaseReservation(db, userId, documentId);
    logger.info("upload.rejected", { documentId, code });
    return new AppError(status, code, message);
  };

  if (!isPathFor(pathname, userId, documentId)) throw await reject(400, "INVALID_REQUEST", "That upload doesn't belong to this document.", false);
  const head = await blobs.head(pathname);
  if (!head) throw await reject(400, "UPLOAD_MISSING", "The upload didn't arrive. Please try again.", false);
  if (head.size > maxPdfBytes())
    throw await reject(413, "FILE_TOO_LARGE", `This file is too large (max ${env.MAX_PDF_SIZE_MB} MB).`);
  const bytes = await blobs.read(pathname);
  if (!bytes) throw await reject(400, "UPLOAD_MISSING", "The upload didn't arrive. Please try again.", false);
  if (Buffer.from(bytes.subarray(0, 5)).toString("latin1") !== "%PDF-")
    throw await reject(400, "NOT_A_PDF", "This file isn't a valid PDF.");
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  try {
    const queued = await db.transaction(async (tx) => {
      const rows = await tx
        .update(documents)
        .set({ status: "queued", sha256, blobPathname: pathname, sizeBytes: head.size })
        .where(and(eq(documents.id, documentId), eq(documents.status, "reserved")))
        .returning();
      if (!rows.length) return null; // a concurrent /complete won
      await tx.insert(uploadEvents).values({ userId, documentId }).onConflictDoNothing();
      await tx.insert(documentProcessingJobs).values({ documentId }).onConflictDoNothing();
      return rows[0]!;
    });
    if (queued) {
      logger.info("upload.queued", { documentId, sizeBytes: head.size });
      kickProcessing(documentId);
    }
  } catch (err) {
    if (isUniqueViolation(err))
      throw await reject(409, "DUPLICATE_DOCUMENT", "You've already uploaded this file.");
    throw err;
  }
  const after = await getOwnedDocument(db, userId, documentId);
  return toSummary(after!.doc, after!.job);
}
