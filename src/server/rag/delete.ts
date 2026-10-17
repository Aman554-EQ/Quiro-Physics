import "server-only";

import { and, eq } from "drizzle-orm";

import { documents } from "@/db/schema";
import type { Db } from "@/server/db";
import { deleteBlobs } from "@/server/storage/blob";

import { documentNotFound } from "./upload";

/**
 * DELETE /api/documents/[id] (Step 3.6): ownership → `deleting` (a running job stops at its next
 * check) → delete the file (missing is fine) → delete the row. Chunks, pages, the job and
 * conversation links cascade; citations keep their snapshot with `document_id = null`; the
 * upload event stays (the weekly quota is unchanged, the active slot is free).
 */
export async function deleteDocument(db: Db, userId: string, documentId: string) {
  const [doc] = await db
    .update(documents)
    .set({ status: "deleting" })
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
    .returning({ blobPathname: documents.blobPathname });
  if (!doc) throw documentNotFound();
  if (doc.blobPathname) await deleteBlobs([doc.blobPathname]);
  await db.delete(documents).where(and(eq(documents.id, documentId), eq(documents.userId, userId)));
}
