import "server-only";

import type { KV } from "@/server/kv";

/**
 * Sliding-window rate limit on the KV store (same algorithm as @upstash/ratelimit's slidingWindow):
 * count = requests in this window + requests in the previous window × the share of it still inside
 * the sliding window. Uses only GET/INCR/PEXPIRE, so MemoryKV and Upstash behave the same.
 */
export async function slidingWindow(
  kv: KV,
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): Promise<{ ok: boolean; remaining: number; resetAt: string }> {
  const current = Math.floor(now / windowMs);
  const elapsed = (now % windowMs) / windowMs;
  const curKey = `rl:${key}:${current}`;
  const prevKey = `rl:${key}:${current - 1}`;
  const [cur, prev] = await Promise.all([kv.get<number>(curKey), kv.get<number>(prevKey)]);
  const used = (cur ?? 0) + (prev ?? 0) * (1 - elapsed);
  const resetAt = new Date((current + 1) * windowMs).toISOString();
  if (used >= limit) return { ok: false, remaining: 0, resetAt };
  const n = await kv.incr(curKey);
  if (n === 1) await kv.pexpire(curKey, windowMs * 2);
  return { ok: true, remaining: Math.max(0, Math.floor(limit - used - 1)), resetAt };
}

export const RATE_LIMITS = {
  guest: { limit: 6, windowMs: 60_000 },
  user: { limit: 10, windowMs: 60_000 },
} as const;
