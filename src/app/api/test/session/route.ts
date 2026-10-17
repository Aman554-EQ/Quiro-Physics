import { z } from "zod";

import { signTestSession, TEST_SESSION_COOKIE } from "@/config/test-session";
import { env } from "@/server/env";
import { jsonError } from "@/server/http";

export const runtime = "nodejs";

/** E2E only (E2E_TEST_AUTH=true; refused on Vercel). Signs a fake Clerk user in or out. */
export async function POST(req: Request) {
  if (!env.E2E_TEST_AUTH) return jsonError(404, "NOT_FOUND", "Not found");
  const { clerkUserId } = z.object({ clerkUserId: z.string().regex(/^user_[A-Za-z0-9_-]{1,64}$/) }).parse(await req.json());
  const res = Response.json({ ok: true });
  res.headers.append(
    "set-cookie",
    `${TEST_SESSION_COOKIE}=${signTestSession(clerkUserId, env.ANON_COOKIE_SECRET)}; Path=/; HttpOnly; SameSite=Lax`,
  );
  return res;
}

export async function DELETE() {
  if (!env.E2E_TEST_AUTH) return jsonError(404, "NOT_FOUND", "Not found");
  const res = Response.json({ ok: true });
  res.headers.append("set-cookie", `${TEST_SESSION_COOKIE}=; Path=/; Max-Age=0`);
  return res;
}
