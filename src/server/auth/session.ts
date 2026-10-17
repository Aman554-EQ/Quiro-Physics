import "server-only";

import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";

import { env } from "@/server/env";

import { TEST_SESSION_COOKIE, verifyTestSession } from "@/config/test-session";

export function isClerkConfigured() {
  return Boolean(env.CLERK_SECRET_KEY && env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) && !env.E2E_TEST_AUTH;
}

/** Accounts are available (Clerk, or the e2e test session). Without them the app is guest-only. */
export function accountsEnabled() {
  return isClerkConfigured() || env.E2E_TEST_AUTH;
}

/** The signed-in Clerk user id, or null for guests. Never read from the request body or query. */
export async function getSessionClerkUserId(): Promise<string | null> {
  if (env.E2E_TEST_AUTH) {
    const jar = await cookies();
    return verifyTestSession(jar.get(TEST_SESSION_COOKIE)?.value, env.ANON_COOKIE_SECRET);
  }
  if (!isClerkConfigured()) return null;
  const { userId } = await auth();
  return userId ?? null;
}
