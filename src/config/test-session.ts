import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * E2E-only sign-in (E2E_TEST_AUTH=true, refused on Vercel by env validation): a cookie holding a
 * fake Clerk user id plus an HMAC, so Playwright can test signed-in flows without Clerk keys.
 * Pure (no `server-only`) because `proxy.ts` uses it too.
 */
export const TEST_SESSION_COOKIE = "prc_test_session";
const FALLBACK_SECRET = "e2e-only-test-session-secret-never-used-in-production";

const mac = (value: string, secret: string) => createHmac("sha256", secret).update(value).digest("base64url");

export function signTestSession(clerkUserId: string, secret = FALLBACK_SECRET) {
  return `${Buffer.from(clerkUserId).toString("base64url")}.${mac(clerkUserId, secret)}`;
}

export function verifyTestSession(cookie: string | undefined | null, secret = FALLBACK_SECRET): string | null {
  if (!cookie) return null;
  const [encoded, sig] = cookie.split(".");
  if (!encoded || !sig) return null;
  const id = Buffer.from(encoded, "base64url").toString();
  if (!/^user_[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  const expected = Buffer.from(mac(id, secret));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given) ? id : null;
}
