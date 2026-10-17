import "server-only";

import { APICallError } from "ai";

export type ErrorCategory =
  | "rate_limit"
  | "provider_5xx"
  | "network"
  | "timeout"
  | "invalid_request"
  | "auth"
  | "context_too_large"
  | "model_unavailable"
  | "aborted"
  | "capacity"
  | "unknown";

/** A model call failed. `partialText` holds whatever was streamed before the failure. */
export class ModelError extends Error {
  readonly category: ErrorCategory;
  readonly status?: number;
  readonly retryAfterMs?: number;
  readonly partialText: string;
  readonly model?: string;
  constructor(opts: {
    category: ErrorCategory;
    message?: string;
    status?: number;
    retryAfterMs?: number;
    partialText?: string;
    model?: string;
  }) {
    super(opts.message ?? `Model call failed (${opts.category})`);
    this.name = "ModelError";
    this.category = opts.category;
    this.status = opts.status;
    this.retryAfterMs = opts.retryAfterMs;
    this.partialText = opts.partialText ?? "";
    this.model = opts.model;
  }
}

/** Every model in the chain is out of free-tier budget (STREAMING.md §8). */
export class CapacityError extends ModelError {
  readonly resetAt: string;
  constructor(resetAt: Date) {
    super({ category: "capacity", message: "MODEL_CAPACITY" });
    this.name = "CapacityError";
    this.resetAt = resetAt.toISOString();
  }
}

/** Parse `retry-after` (seconds or HTTP date) into ms. */
export function parseRetryAfter(value: string | null | undefined, now = Date.now()): number | undefined {
  if (!value) return undefined;
  const secs = Number(value);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - now);
}

function statusCategory(status: number): ErrorCategory {
  if (status === 429) return "rate_limit";
  if (status === 401) return "auth";
  // 403 on Groq is per model (blocked or not enabled for this org): the next model may work.
  if (status === 403) return "model_unavailable";
  if (status === 413) return "context_too_large";
  if (status === 404) return "model_unavailable";
  if (status === 408) return "timeout";
  if (status >= 500) return "provider_5xx";
  if (status >= 400) return "invalid_request";
  return "unknown";
}

const NETWORK_CODES = new Set(["ECONNRESET", "ECONNREFUSED", "EPIPE", "ENOTFOUND", "EAI_AGAIN", "UND_ERR_SOCKET"]);
const TIMEOUT_CODES = new Set(["ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT"]);

function errorCode(err: unknown): string | undefined {
  let e: unknown = err;
  for (let i = 0; i < 4 && e && typeof e === "object"; i++) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === "string") return code;
    e = (e as { cause?: unknown }).cause;
  }
  return undefined;
}

/** Map anything thrown by a provider call to a category (P2-S1-A13). */
export function classifyError(err: unknown): ModelError {
  if (err instanceof ModelError) return err;
  if (APICallError.isInstance(err)) {
    const status = err.statusCode ?? 0;
    const headers = err.responseHeaders ?? {};
    const body = (err.responseBody ?? "").toLowerCase();
    let category = statusCategory(status);
    if (status === 400 && /context|too long|maximum.*tokens|reduce the length/.test(body)) category = "context_too_large";
    if (status === 400 && /model.*(not found|decommissioned|does not exist)/.test(body)) category = "model_unavailable";
    if (status === 0) category = "network";
    return new ModelError({
      category,
      status: status || undefined,
      retryAfterMs: parseRetryAfter(headers["retry-after"]),
      message: `Provider returned ${status || "no status"}`,
    });
  }
  const name = (err as { name?: string } | null)?.name;
  if (name === "AbortError") return new ModelError({ category: "aborted", message: "Aborted" });
  if (name === "TimeoutError") return new ModelError({ category: "timeout", message: "Timed out" });
  const code = errorCode(err);
  if (code && TIMEOUT_CODES.has(code)) return new ModelError({ category: "timeout", message: code });
  if (code && NETWORK_CODES.has(code)) return new ModelError({ category: "network", message: code });
  // Fetch failures and torn-down streams surface as TypeErrors ("fetch failed", "terminated").
  if (err instanceof TypeError) return new ModelError({ category: "network", message: "Network error" });
  return new ModelError({ category: "unknown", message: "Unexpected model error" });
}

/** Worth retrying on the same model? */
export const isTransient = (c: ErrorCategory) =>
  c === "rate_limit" || c === "provider_5xx" || c === "network" || c === "timeout";

/**
 * Worth trying the next model in the chain (before the first token only)? Anything except a bad
 * API key (same for every model), a user abort, or no budget: a 400 is often model specific
 * (unsupported parameter, smaller context, retired id), so the next model may still answer.
 */
export const allowsFallback = (c: ErrorCategory) => c !== "auth" && c !== "aborted" && c !== "capacity";
