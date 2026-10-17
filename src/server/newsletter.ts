import "server-only";

import { createHash } from "node:crypto";

import { z } from "zod";

import type { KV } from "@/server/kv";

/**
 * The weekly physics email: subscribers live in the KV store (Upstash in production), one key per
 * address hash, `{ email, subscribedAt, source }`, no expiry. No database table, so no migration.
 * Export them from the Upstash console (keys `newsletter:sub:*`) to send an issue.
 */
export const NewsletterSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  /** Honeypot field: filled only by bots. */
  website: z.string().max(200).optional().default(""),
});

export const NEWSLETTER_RATE = { limit: 5, windowMs: 60 * 60_000 } as const;

export const subscriberKey = (email: string) =>
  `newsletter:sub:${createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 40)}`;

export async function subscribe(kv: KV, email: string, now = new Date()): Promise<"subscribed" | "already"> {
  const created = await kv.set(subscriberKey(email), { email, subscribedAt: now.toISOString(), source: "footer" }, { nx: true });
  return created === "OK" ? "subscribed" : "already";
}
