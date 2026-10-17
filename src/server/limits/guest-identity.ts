import "server-only";

import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

import { env } from "@/server/env";
import { logger } from "@/server/log";
import { processSingleton } from "@/server/singleton";

/**
 * Guest identity (LIMITS_AND_QUOTAS.md §3): cookie `prc_guest` = base64url(id) + "." + HMAC.
 * A tampered cookie is never used as a key; a new id is issued instead (P2-S5-A02).
 * ipHash = sha256(ip + daily salt): the raw IP is never stored anywhere (P2-S5-A06).
 */
export const GUEST_COOKIE = "prc_guest";
const MAX_AGE = 60 * 60 * 24 * 30;

// Fallback when ANON_COOKIE_SECRET is unset: one random secret per process (shared by every route).
const fallbackSecret = processSingleton<string>("guest-secret");
function secret() {
  if (env.ANON_COOKIE_SECRET) return env.ANON_COOKIE_SECRET;
  let s = fallbackSecret.get();
  if (!s) {
    s = randomBytes(32).toString("hex");
    fallbackSecret.set(s);
    if (env.NODE_ENV === "production")
      logger.warn("guest.secret_missing", { reason: "ANON_COOKIE_SECRET not set: guest cookies reset on restart" });
  }
  return s;
}

const mac = (id: string) => createHmac("sha256", secret()).update(`guest:${id}`).digest("base64url");

export function signGuestId(id: string) {
  return `${Buffer.from(id).toString("base64url")}.${mac(id)}`;
}

export function verifyGuestCookie(value: string | null | undefined): string | null {
  if (!value) return null;
  const [encoded, sig] = value.split(".");
  if (!encoded || !sig) return null;
  const id = Buffer.from(encoded, "base64url").toString();
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const expected = Buffer.from(mac(id));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given) ? id : null;
}

export function guestCookieHeader(id: string) {
  // Secure everywhere except plain-HTTP local dev and e2e (WebKit drops Secure cookies on http://localhost).
  const secure = env.NODE_ENV === "development" || process.env.E2E ? "" : "; Secure";
  return `${GUEST_COOKIE}=${signGuestId(id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${secure}`;
}

function readCookie(req: Request, name: string) {
  const header = req.headers.get("cookie") ?? "";
  for (const part of header.split(/;\s*/)) {
    const eq = part.indexOf("=");
    if (eq > 0 && part.slice(0, eq) === name) return decodeURIComponent(part.slice(eq + 1));
  }
  return null;
}

/** The guest id from a valid cookie, or a fresh one plus the Set-Cookie header to send. */
export function resolveGuest(req: Request): { guestId: string; setCookie: string | null } {
  const existing = verifyGuestCookie(readCookie(req, GUEST_COOKIE));
  if (existing) return { guestId: existing, setCookie: null };
  const guestId = randomUUID();
  return { guestId, setCookie: guestCookieHeader(guestId) };
}

export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

export const utcDay = (now = new Date()) => now.toISOString().slice(0, 10).replaceAll("-", "");

/** Daily-salted, keyed hash: stable for one UTC day, unlinkable across days, never reversible. */
export function ipHash(ip: string, now = new Date()) {
  const salt = createHmac("sha256", secret()).update(`ip-salt:${utcDay(now)}`).digest();
  return createHash("sha256").update(salt).update(ip).digest("hex").slice(0, 32);
}

/** Short hash of a guest id for metrics (`model_usage.guest_hash`). */
export const guestHash = (guestId: string) => createHash("sha256").update(guestId).digest("hex").slice(0, 16);
