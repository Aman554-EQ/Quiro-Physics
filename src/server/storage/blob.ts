import "server-only";

import { logger } from "@/server/log";

/**
 * Blob storage for uploaded PDFs. Uploads arrive in Phase 3; Phase 2 only needs deletion, so
 * account deletion already removes a user's files. The Vercel Blob client is wired in Phase 3.
 */
export async function deleteBlobs(pathnames: string[]): Promise<void> {
  if (pathnames.length === 0) return;
  logger.info("blob.delete", { count: pathnames.length });
}
