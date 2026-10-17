import { z } from "zod";

import { requireUser } from "@/server/auth/require-user";
import { getDb } from "@/server/db";
import { AppError, route } from "@/server/http";
import { completeUpload, documentNotFound } from "@/server/rag/upload";
import { getBlobStore } from "@/server/storage/blob";

export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };
const BodySchema = z.object({ pathname: z.string().min(1).max(300) });

/** The browser finished uploading: verify the file and queue processing (Step 3.2). */
export const POST = route(async (req: Request, ctx: Ctx) => {
  const { userId } = await requireUser();
  const id = z.string().uuid().safeParse((await ctx.params).id);
  if (!id.success) throw documentNotFound();
  const { pathname } = BodySchema.parse(await req.json());
  const blobs = getBlobStore();
  if (!blobs) throw new AppError(503, "UPLOADS_UNAVAILABLE", "PDF uploads aren't configured on this server yet.");
  return Response.json(await completeUpload(await getDb(), blobs, userId, id.data, pathname));
});
