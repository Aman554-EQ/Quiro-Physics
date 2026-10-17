import "server-only";

import { and, eq, isNotNull } from "drizzle-orm";

import type { Db } from "@/server/db";
import { documents, users } from "@/db/schema";

/** Webhook upsert: create on first sight, update profile fields afterwards (idempotent). */
export async function upsertUserFromClerk(
  db: Db,
  data: { clerkUserId: string; email: string | null; displayName: string | null },
) {
  const [row] = await db
    .insert(users)
    .values(data)
    .onConflictDoUpdate({
      target: users.clerkUserId,
      set: { email: data.email, displayName: data.displayName },
    })
    .returning({ id: users.id });
  return row!.id;
}

/**
 * Delete a user and everything they own (cascades). Returns the blob paths of their PDFs, which
 * live outside the database and must be deleted separately (SECURITY S13).
 */
export async function deleteUserByClerkId(db: Db, clerkUserId: string) {
  return db.transaction(async (tx) => {
    const [user] = await tx.select({ id: users.id }).from(users).where(eq(users.clerkUserId, clerkUserId));
    if (!user) return { deleted: false, blobPathnames: [] as string[] };
    const blobs = await tx
      .select({ path: documents.blobPathname })
      .from(documents)
      .where(and(eq(documents.userId, user.id), isNotNull(documents.blobPathname)));
    await tx.delete(users).where(eq(users.id, user.id));
    return { deleted: true, blobPathnames: blobs.map((b) => b.path!) };
  });
}
