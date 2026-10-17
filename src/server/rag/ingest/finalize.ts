import "server-only";

import { and, count, eq, isNull } from "drizzle-orm";

import { documentChunks, documentPages, documentProcessingJobs, documents } from "@/db/schema";
import { env } from "@/server/env";

import { EMBEDDING_DIM } from "../embeddings";

import type { StageContext, StageResult } from "./context";

/**
 * Finalise (Step 3.4): only when no chunk lacks an embedding (otherwise back to `embed`, A13).
 * Ready → staging pages purged; the PDF deleted unless RETAIN_PDF=true.
 */
export async function finalizeBatch(ctx: StageContext): Promise<StageResult & { backTo?: "embed" }> {
  const { db, doc } = ctx;
  const [{ n: missing } = { n: 0 }] = await db
    .select({ n: count() })
    .from(documentChunks)
    .where(and(eq(documentChunks.documentId, doc.id), isNull(documentChunks.embedding)));
  if (missing > 0) return { done: false, backTo: "embed" };

  const [{ n: chunks } = { n: 0 }] = await db
    .select({ n: count() })
    .from(documentChunks)
    .where(eq(documentChunks.documentId, doc.id));
  const deletePdf = !env.RETAIN_PDF && doc.blobPathname;
  await db.transaction(async (tx) => {
    await tx
      .update(documents)
      .set({
        status: "ready",
        readyAt: new Date(ctx.now()),
        chunkCount: chunks,
        embeddingModel: ctx.embeddings.modelId,
        embeddingDim: EMBEDDING_DIM,
        error: null,
        ...(deletePdf ? { blobPathname: null } : {}),
      })
      .where(eq(documents.id, doc.id));
    await tx.delete(documentPages).where(eq(documentPages.documentId, doc.id));
    await tx
      .update(documentProcessingJobs)
      .set({ stage: "done", cursor: chunks, total: chunks })
      .where(eq(documentProcessingJobs.documentId, doc.id));
  });
  if (deletePdf) await ctx.blobs.del([doc.blobPathname!]).catch(() => undefined);
  return { done: true };
}
