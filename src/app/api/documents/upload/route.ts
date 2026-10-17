import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { z } from "zod";

import { requireUser } from "@/server/auth/require-user";
import { getDb } from "@/server/db";
import { getOwnedDocument } from "@/server/db/queries/documents";
import { env } from "@/server/env";
import { AppError, route } from "@/server/http";
import { documentNotFound, maxPdfBytes } from "@/server/rag/upload";
import { blobPathFor } from "@/server/storage/blob";

export const runtime = "nodejs";

const PayloadSchema = z.object({ documentId: z.string().uuid() });

/**
 * Vercel Blob client-upload token (Step 3.2). Only for a document the caller reserved, only for its
 * exact pathname `u/{userId}/{documentId}.pdf`, PDF only, at most MAX_PDF_SIZE_MB. Completion is
 * NOT taken from Blob's callback (it doesn't fire on localhost): the browser calls /complete.
 */
export const POST = route(async (req: Request) => {
  if (!env.BLOB_READ_WRITE_TOKEN) throw new AppError(503, "UPLOADS_UNAVAILABLE", "Blob storage isn't configured.");
  const body = (await req.json()) as HandleUploadBody;
  const result = await handleUpload({
    body,
    request: req,
    token: env.BLOB_READ_WRITE_TOKEN,
    onBeforeGenerateToken: async (pathname, clientPayload) => {
      const { userId } = await requireUser();
      const { documentId } = PayloadSchema.parse(JSON.parse(clientPayload ?? "{}"));
      const owned = await getOwnedDocument(await getDb(), userId, documentId);
      if (!owned || owned.doc.status !== "reserved") throw documentNotFound();
      if (pathname !== blobPathFor(userId, documentId)) throw new AppError(400, "INVALID_REQUEST", "Unexpected upload path.");
      return {
        allowedContentTypes: ["application/pdf"],
        maximumSizeInBytes: maxPdfBytes(),
        addRandomSuffix: true,
        tokenPayload: JSON.stringify({ documentId }),
      };
    },
  });
  return Response.json(result);
});
