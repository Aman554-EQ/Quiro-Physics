import "server-only";

import { createGroq } from "@ai-sdk/groq";

import type { KV } from "@/server/kv";

import { markExhausted, recordBudget } from "./budget";
import { parseRetryAfter } from "./errors";

/**
 * Groq provider whose fetch records every response's rate-limit headers in the budget store
 * (`groq:budget:{model}`), so the router can skip exhausted models before calling them.
 */
export function createBudgetedGroq(opts: { apiKey: string; kv: KV; baseURL?: string; fetch?: typeof fetch }) {
  const budgetFetch: typeof fetch = async (input, init) => {
    // Resolved per call (not captured once), so instrumentation and test interceptors apply.
    const res = await (opts.fetch ?? globalThis.fetch)(input, init);
    let model: string | undefined;
    try {
      if (typeof init?.body === "string") model = (JSON.parse(init.body) as { model?: string }).model;
    } catch {}
    if (model) {
      if (res.status === 429) await markExhausted(opts.kv, model, parseRetryAfter(res.headers.get("retry-after")));
      else await recordBudget(opts.kv, model, res.headers);
    }
    return res;
  };
  return createGroq({ apiKey: opts.apiKey, baseURL: opts.baseURL, fetch: budgetFetch });
}
