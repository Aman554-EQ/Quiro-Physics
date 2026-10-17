import "server-only";

import { connection } from "next/server";

import { env } from "@/server/env";
import type { Viewer } from "@/shared/viewer";

import { getSessionClerkUserId, isClerkConfigured } from "./session";

export async function getViewer(): Promise<Viewer> {
  // Always per request: the signed-in state must never be baked into a prerendered page.
  await connection();
  const accounts = isClerkConfigured() ? "clerk" : env.E2E_TEST_AUTH ? "test" : "none";
  if (accounts === "none") return { signedIn: false, accounts };
  return { signedIn: Boolean(await getSessionClerkUserId()), accounts };
}
