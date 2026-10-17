import "server-only";

import { and, count, eq } from "drizzle-orm";

import { documentPages, documentProcessingJobs, documents } from "@/db/schema";
import { env } from "@/server/env";

import { openPdf } from "../pdf";

import { FileFaultError, type StageContext, type StageResult } from "./context";
import { cleanText, toSearchText } from "./normalize";

/**
 * Extract stage (RAG_PIPELINE.md §1): pages in batches of 25, 1-based page numbers, raw text kept
 * byte for byte, `normalized_text` = search text of the page. Resumes from `job.cursor`.
 */
export const EXTRACT_BATCH = 25;
/** Fewer characters than this → treated as a scanned (image-only) page. */
export const SCANNED_CHARS = 30;
export const SCANNED_WARNING_FRACTION = 0.3;

export async function extractBatch(ctx: StageContext): Promise<StageResult> {
  const { db, doc, job } = ctx;
  if (!doc.blobPathname) throw new FileFaultError("The uploaded file is missing. Please upload it again.");
  const bytes = await ctx.blobs.read(doc.blobPathname);
  if (!bytes) throw new FileFaultError("The uploaded file is missing. Please upload it again.");
  const pdf = await openPdf(bytes);
  try {
    if (pdf.numPages > env.MAX_PDF_PAGES)
      throw new FileFaultError(`This PDF has more than ${env.MAX_PDF_PAGES} pages. Split it into smaller parts and upload those.`);
    const total = pdf.numPages;
    let cursor = job.cursor;
    while (cursor < total && ctx.now() < ctx.deadline) {
      const end = Math.min(cursor + EXTRACT_BATCH, total);
      const rows = [];
      for (let n = cursor + 1; n <= end; n++) {
        const raw = await pdf.pageText(n);
        rows.push({
          documentId: doc.id,
          pageNumber: n,
          rawText: raw,
          normalizedText: toSearchText(cleanText(raw)),
          isScanned: raw.trim().length < SCANNED_CHARS,
        });
      }
      // Idempotent: a batch re-run after a crash writes nothing twice (P3-S3-A04).
      await db.insert(documentPages).values(rows).onConflictDoNothing();
      cursor = end;
      await db.update(documentProcessingJobs).set({ cursor, total }).where(eq(documentProcessingJobs.documentId, doc.id));
      job.cursor = cursor;
      job.total = total;
    }
    if (cursor < total) return { done: false };

    const [{ n: scanned } = { n: 0 }] = await db
      .select({ n: count() })
      .from(documentPages)
      .where(and(eq(documentPages.documentId, doc.id), eq(documentPages.isScanned, true)));
    if (scanned === total) throw new FileFaultError("This PDF looks scanned: no page has readable text.");
    const warning =
      scanned > 0 && scanned / total > SCANNED_WARNING_FRACTION
        ? `This PDF looks partly scanned: only ${total - scanned} of ${total} pages had readable text.`
        : scanned > 0
          ? `${scanned} ${scanned === 1 ? "page has" : "pages have"} no readable text and won't be searched.`
          : null;
    await db
      .update(documents)
      .set({ pageCount: total, scannedPages: scanned, warning })
      .where(eq(documents.id, doc.id));
    return { done: true };
  } finally {
    await pdf.destroy();
  }
}
