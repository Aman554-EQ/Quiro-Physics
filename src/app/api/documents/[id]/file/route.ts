import { z } from "zod";

import { requireUser } from "@/server/auth/require-user";
import { getDb } from "@/server/db";
import { getOwnedDocument } from "@/server/db/queries/documents";
import { env } from "@/server/env";
import { AppError, route } from "@/server/http";
import { documentNotFound, maxPdfBytes } from "@/server/rag/upload";
import { blobPathFor, getBlobStore } from "@/server/storage/blob";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Local uploads (development without a Blob token): the browser PUTs the PDF bytes here. Only for
 * a reserved document of the caller; capped at MAX_PDF_SIZE_MB while reading.
 */
export const PUT = route(async (req: Request, ctx: Ctx) => {
  const { userId } = await requireUser();
  const store = getBlobStore();
  if (!store?.put) throw new AppError(404, "NOT_FOUND", "Not found");
  const id = z.string().uuid().safeParse((await ctx.params).id);
  const owned = id.success ? await getOwnedDocument(await getDb(), userId, id.data) : null;
  if (!owned || owned.doc.status !== "reserved") throw documentNotFound();
  if (!req.body) throw new AppError(400, "UPLOAD_MISSING", "No file was sent.");

  const limit = maxPdfBytes();
  const parts: Uint8Array[] = [];
  let size = 0;
  const reader = req.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new AppError(413, "FILE_TOO_LARGE", `This file is too large (max ${env.MAX_PDF_SIZE_MB} MB).`);
    }
    parts.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const p of parts) {
    bytes.set(p, offset);
    offset += p.byteLength;
  }
  const pathname = blobPathFor(userId, id.data!);
  await store.put(pathname, bytes);
  return Response.json({ pathname });
});
