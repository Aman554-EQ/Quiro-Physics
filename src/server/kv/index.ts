import "server-only";

import { Redis } from "@upstash/redis";

import { env } from "@/server/env";
import { logger } from "@/server/log";

import { processSingleton } from "../singleton";

import { MemoryKV, type KV } from "./kv";

export type { KV } from "./kv";
export { MemoryKV } from "./kv";

const slot = processSingleton<KV>("kv");

/**
 * Shared KV store. Upstash when configured; otherwise an in-memory store (fine for one dev server,
 * but limits reset on restart and aren't shared between instances, so production warns once).
 */
export function getKV(): KV {
  const existing = slot.get();
  if (existing) return existing;
  let instance: KV;
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    instance = new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN }) as unknown as KV;
  } else {
    if (env.NODE_ENV === "production" && !process.env.E2E)
      logger.warn("kv.memory_fallback", { reason: "UPSTASH_REDIS_REST_URL not set" });
    instance = new MemoryKV();
  }
  slot.set(instance);
  return instance;
}

/** Tests inject a fresh MemoryKV. */
export function setKVForTests(kv: KV | null) {
  slot.set(kv ?? undefined);
}
