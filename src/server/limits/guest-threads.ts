import "server-only";

import { randomUUID } from "node:crypto";

import { env } from "@/server/env";
import { AppError } from "@/server/http";
import type { KV } from "@/server/kv";

import { utcDay } from "./guest-identity";

/**
 * Guest threads live only in Redis (24 h TTL), never in Postgres unless the user signs in and
 * saves them (LIMITS_AND_QUOTAS.md §3). Keys:
 *   guest:thread:{id}                       { guestId, messages, createdAt }
 *   guest:turns:{id}                        turns used in the thread
 *   rl:guest:threads:{guestId|ipHash}:{day} new threads today (cookie and IP backstop)
 */
export const THREAD_TTL_S = 86_400;

export interface GuestTurn {
  role: "user" | "assistant";
  text: string;
  status?: "complete" | "cancelled" | "error";
}

export interface GuestThread {
  guestId: string;
  createdAt: string;
  messages: GuestTurn[];
}

export const threadKey = (id: string) => `guest:thread:${id}`;
export const turnsKey = (id: string) => `guest:turns:${id}`;
const dailyKey = (who: string, day: string) => `rl:guest:threads:${who}:${day}`;

export class LimitError extends AppError {
  constructor(code: string, message: string, resetAt?: string) {
    super(429, code, message, resetAt);
  }
}

const nextUtcMidnight = (now: Date) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString();

export async function getThread(kv: KV, threadId: string) {
  return kv.get<GuestThread>(threadKey(threadId));
}

/** Threads started today by this guest (the larger of the cookie and IP counters). */
export async function threadsToday(kv: KV, guestId: string, ipHash: string, now = new Date()) {
  const day = utcDay(now);
  const [byGuest, byIp] = await Promise.all([
    kv.get<number>(dailyKey(guestId, day)),
    kv.get<number>(dailyKey(ipHash, day)),
  ]);
  return { used: Math.max(byGuest ?? 0, byIp ?? 0), resetAt: nextUtcMidnight(now) };
}

/**
 * Open a guest turn: continue the caller's thread (≤ GUEST_MAX_TURNS_PER_THREAD turns) or start a
 * new one (≤ GUEST_MAX_THREADS_PER_DAY per UTC day). Throws LimitError (429) before any model call.
 */
export async function openGuestTurn(
  kv: KV,
  opts: { guestId: string; ipHash: string; threadId?: string },
  now = new Date(),
): Promise<{ threadId: string; thread: GuestThread; turn: number; remaining: number; limit: number }> {
  const maxTurns = env.GUEST_MAX_TURNS_PER_THREAD;
  const existing = opts.threadId ? await getThread(kv, opts.threadId) : null;

  if (existing && existing.guestId === opts.guestId) {
    const used = (await kv.get<number>(turnsKey(opts.threadId!))) ?? 0;
    if (used >= maxTurns)
      throw new LimitError(
        "GUEST_TURN_LIMIT",
        "Sign in to continue this conversation. A free account keeps every chat.",
      );
    const turn = await kv.incr(turnsKey(opts.threadId!));
    await kv.expire(turnsKey(opts.threadId!), THREAD_TTL_S);
    return { threadId: opts.threadId!, thread: existing, turn, remaining: maxTurns - turn, limit: maxTurns };
  }

  const { used, resetAt } = await threadsToday(kv, opts.guestId, opts.ipHash, now);
  if (used >= env.GUEST_MAX_THREADS_PER_DAY)
    throw new LimitError(
      "GUEST_DAILY_LIMIT",
      "Sign in to keep asking. A free account keeps every chat.",
      resetAt,
    );
  const day = utcDay(now);
  for (const who of [opts.guestId, opts.ipHash]) {
    const n = await kv.incr(dailyKey(who, day));
    if (n === 1) await kv.expire(dailyKey(who, day), 2 * 86_400);
  }
  const threadId = randomUUID();
  const thread: GuestThread = { guestId: opts.guestId, createdAt: now.toISOString(), messages: [] };
  await kv.set(threadKey(threadId), thread, { ex: THREAD_TTL_S });
  await kv.set(turnsKey(threadId), 1, { ex: THREAD_TTL_S });
  return { threadId, thread, turn: 1, remaining: maxTurns - 1, limit: maxTurns };
}

/** Append the finished exchange to the guest thread (keeps the 24 h TTL from creation). */
export async function appendGuestTurn(kv: KV, threadId: string, turns: GuestTurn[]) {
  const thread = await getThread(kv, threadId);
  if (!thread) return;
  const ttl = await kv.ttl(threadKey(threadId));
  await kv.set(
    threadKey(threadId),
    { ...thread, messages: [...thread.messages, ...turns] },
    { ex: ttl > 0 ? ttl : THREAD_TTL_S },
  );
}
