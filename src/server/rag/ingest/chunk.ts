import "server-only";

import { asc, eq } from "drizzle-orm";

import { documentChunks, documentPages, documentProcessingJobs, documents } from "@/db/schema";

import { FileFaultError, type StageContext, type StageResult } from "./context";
import { cleanText, repeatedLines } from "./normalize";
import { ChunkLimitError, MAX_CHUNKS, overviewChunk, splitDocument } from "./splitter";

const INSERT_BATCH = 100;

/**
 * Chunk stage: running heads are found across all pages, pages are cleaned and split by the
 * PhysicsAwareSplitter. Deterministic, and inserts skip existing (document_id, chunk_index), so a
 * re-run after a crash is safe.
 */
export async function chunkBatch(ctx: StageContext): Promise<StageResult> {
  const { db, doc } = ctx;
  const pages = await db
    .select({ page: documentPages.pageNumber, raw: documentPages.rawText, scanned: documentPages.isScanned })
    .from(documentPages)
    .where(eq(documentPages.documentId, doc.id))
    .orderBy(asc(documentPages.pageNumber));
  const repeated = repeatedLines(pages.map((p) => p.raw));
  const readable = pages.filter((p) => !p.scanned).map((p) => ({ page: p.page, text: cleanText(p.raw, repeated) }));

  let drafts;
  try {
    drafts = splitDocument(doc.title, readable);
  } catch (err) {
    if (err instanceof ChunkLimitError) throw new FileFaultError(err.message);
    throw err;
  }
  if (drafts.length === 0) throw new FileFaultError("No readable text was found in this PDF.");
  const overview = overviewChunk(doc.title, doc.pageCount ?? pages.length, readable, drafts);
  if (overview && drafts.length < MAX_CHUNKS) drafts.push(overview);

  for (let i = 0; i < drafts.length; i += INSERT_BATCH) {
    await db
      .insert(documentChunks)
      .values(drafts.slice(i, i + INSERT_BATCH).map((d) => ({ ...d, documentId: doc.id, userId: doc.userId })))
      .onConflictDoNothing();
  }
  await db.update(documents).set({ chunkCount: drafts.length }).where(eq(documents.id, doc.id));
  await db
    .update(documentProcessingJobs)
    .set({ cursor: 0, total: drafts.length })
    .where(eq(documentProcessingJobs.documentId, doc.id));
  return { done: true };
}
