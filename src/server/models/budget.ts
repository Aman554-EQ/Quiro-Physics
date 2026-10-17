import "server-only";

import type { KV } from "@/server/kv";

/**
 * Per-model free-tier budget from Groq's rate-limit headers, so the router can skip a model that
 * would only answer 429 (STREAMING.md §8). Stored at `groq:budget:{model}` until the provider resets.
 */
export interface Budget {
  remainingTokens: number | null;
  remainingRequests: number | null;
  /** ISO time when the token/request window resets (the later of the two we know about). */
  resetAt: string;
}

export const budgetKey = (model: string) => `groq:budget:${model}`;

/** Groq durations look like "7.66s", "2m59.56s", "1h2m3s", "120ms". Returns ms. */
export function parseGroqDuration(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const re = /(\d+(?:\.\d+)?)(ms|h|m|s)/g;
  let total = 0;
  let matched = false;
  for (const [, n, unit] of value.matchAll(re)) {
    matched = true;
    const v = Number(n);
    total += unit === "h" ? v * 3_600_000 : unit === "m" ? v * 60_000 : unit === "s" ? v * 1000 : v;
  }
  return matched ? total : undefined;
}

type HeaderSource = Headers | Record<string, string | undefined>;
const header = (h: HeaderSource, name: string) =>
  h instanceof Headers ? h.get(name) : (h[name] ?? h[name.toLowerCase()] ?? null);

const num = (v: string | null | undefined) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Store what the response headers say about this model's remaining budget. */
export async function recordBudget(kv: KV, model: string, headers: HeaderSource, now = Date.now()) {
  const remainingTokens = num(header(headers, "x-ratelimit-remaining-tokens"));
  const remainingRequests = num(header(headers, "x-ratelimit-remaining-requests"));
  if (remainingTokens === null && remainingRequests === null) return;
  const resetMs = Math.max(
    parseGroqDuration(header(headers, "x-ratelimit-reset-tokens")) ?? 0,
    remainingRequests === 0 ? (parseGroqDuration(header(headers, "x-ratelimit-reset-requests")) ?? 0) : 0,
    1000,
  );
  const budget: Budget = { remainingTokens, remainingRequests, resetAt: new Date(now + resetMs).toISOString() };
  await kv.set(budgetKey(model), budget, { px: Math.ceil(resetMs / 1000) * 1000 });
}

/** A 429 tells us the model is exhausted until `retry-after` (or ~60 s if unknown). */
export async function markExhausted(kv: KV, model: string, retryAfterMs: number | undefined, now = Date.now()) {
  const ms = Math.max(1000, retryAfterMs ?? 60_000);
  const budget: Budget = { remainingTokens: 0, remainingRequests: 0, resetAt: new Date(now + ms).toISOString() };
  await kv.set(budgetKey(model), budget, { px: Math.ceil(ms / 1000) * 1000 });
}

export async function getBudget(kv: KV, model: string): Promise<Budget | null> {
  return kv.get<Budget>(budgetKey(model));
}

/** True when nothing is known (optimistic) or the last headers leave room for `estTokens`. */
export async function hasHeadroom(kv: KV, model: string, estTokens: number): Promise<boolean> {
  const b = await getBudget(kv, model);
  if (!b) return true;
  if (b.remainingRequests !== null && b.remainingRequests <= 0) return false;
  if (b.remainingTokens !== null && b.remainingTokens < estTokens) return false;
  return true;
}
