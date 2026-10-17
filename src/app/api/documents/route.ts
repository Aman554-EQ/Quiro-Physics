import { eq } from "drizzle-orm";
import { z } from "zod";

import { documents } from "@/db/schema";
import { requireUser } from "@/server/auth/require-user";
import { getDb } from "@/server/db";
import { listDocuments, toSummary } from "@/server/db/queries/documents";
import { env } from "@/server/env";
import { AppError, route } from "@/server/http";
import { getKV } from "@/server/kv";
import { assertStorage, reserveUpload, uploadUsage } from "@/server/limits/quotas";
import { maxPdfBytes } from "@/server/rag/upload";
import { blobPathFor, getBlobStore } from "@/server/storage/blob";

export const runtime = "nodejs";

/** The caller's documents and upload quotas (Library). */
export const GET = route(async () => {
  const { userId } = await requireUser();
  const db = await getDb();
  const [docs, usage] = await Promise.all([listDocuments(db, userId), uploadUsage(db, userId)]);
  return Response.json({ documents: docs, ...usage, maxSizeMb: env.MAX_PDF_SIZE_MB, maxPages: env.MAX_PDF_PAGES });
});

const ReserveSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  sizeBytes: z.number().int().positive(),
});

/**
 * Reserve an upload slot (quota checked under a per-user lock), then the browser uploads the file:
 * - `blob`: Vercel Blob client upload to exactly `pathname` (token from /api/documents/upload);
 * - `local`: PUT the bytes to /api/documents/[id]/file (development without a Blob token).
 * Then it calls /api/documents/[id]/complete.
 */
export const POST = route(async (req: Request) => {
  const { userId } = await requireUser();
  const body = ReserveSchema.parse(await req.json());
  if (!/\.pdf$/i.test(body.filename)) throw new AppError(400, "NOT_A_PDF", "Only PDF files can be uploaded.");
  if (body.sizeBytes > maxPdfBytes())
    throw new AppError(413, "FILE_TOO_LARGE", `This file is too large (max ${env.MAX_PDF_SIZE_MB} MB).`);
  const store = getBlobStore();
  if (!store) throw new AppError(503, "UPLOADS_UNAVAILABLE", "PDF uploads aren't configured on this server yet.");
  const db = await getDb();
  await assertStorage(db, getKV());
  const doc = await reserveUpload(db, userId, { filename: body.filename, sizeBytes: body.sizeBytes });
  const pathname = blobPathFor(userId, doc.id);
  await db.update(documents).set({ blobPathname: pathname }).where(eq(documents.id, doc.id));
  return Response.json(
    {
      document: toSummary({ ...doc, blobPathname: pathname }, null),
      upload: { mode: store.kind === "vercel" ? "blob" : "local", pathname, maxBytes: maxPdfBytes() },
    },
    { status: 201 },
  );
});
