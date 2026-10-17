import "server-only";

import { after } from "next/server";

import { logger } from "@/server/log";

/**
 * Work that must finish after the response (persistence on abort, titles, summaries).
 * Inside a request it uses Next's `after()` (kept alive on Vercel); outside one (tests, scripts)
 * it just runs, and `flushAfter()` waits for everything scheduled so far.
 */
const pending = new Set<Promise<unknown>>();

export function runAfter(task: () => Promise<unknown>) {
  const p = (async () => {
    try {
      await task();
    } catch (err) {
      logger.error("after.failed", { name: (err as Error)?.name ?? "unknown" });
    }
  })();
  pending.add(p);
  void p.finally(() => pending.delete(p));
  try {
    after(() => p);
  } catch {
    // Not inside a request scope: the promise above is already running.
  }
  return p;
}

export async function flushAfter() {
  while (pending.size) await Promise.all([...pending]);
}
