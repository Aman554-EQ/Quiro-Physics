import "server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/server/db";
import { users } from "@/db/schema";

import { getSessionClerkUserId } from "./session";

export class UnauthorizedError extends Error {
  constructor() {
    super("Sign in required");
    this.name = "UnauthorizedError";
  }
}

export interface SessionUser {
  /** Internal id (uuid) used by every query. Never the Clerk id, never from the client. */
  userId: string;
  clerkUserId: string;
}

/** Find or create the internal user row for a Clerk user (idempotent, race-safe). */
export async function ensureUser(clerkUserId: string): Promise<string> {
  const db = await getDb();
  const [found] = await db.select({ id: users.id }).from(users).where(eq(users.clerkUserId, clerkUserId));
  if (found) return found.id;
  await db.insert(users).values({ clerkUserId }).onConflictDoNothing({ target: users.clerkUserId });
  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.clerkUserId, clerkUserId));
  return row!.id;
}

/** The signed-in user, or null. Lazily creates the users row (the webhook may not have arrived yet). */
export async function getOptionalUser(): Promise<SessionUser | null> {
  const clerkUserId = await getSessionClerkUserId();
  if (!clerkUserId) return null;
  return { clerkUserId, userId: await ensureUser(clerkUserId) };
}

/** The signed-in user, or throws `UnauthorizedError` (→ 401). Takes no input on purpose (SECURITY S2). */
export async function requireUser(): Promise<SessionUser> {
  const user = await getOptionalUser();
  if (!user) throw new UnauthorizedError();
  return user;
}
