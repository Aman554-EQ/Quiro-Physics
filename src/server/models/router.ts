import "server-only";

import type { LanguageModel, LanguageModelUsage, TextStreamPart, ToolSet } from "ai";

import type { KV } from "@/server/kv";
import { logger } from "@/server/log";

import { getBudget, hasHeadroom, markExhausted } from "./budget";
import { allowsFallback, CapacityError, classifyError, isTransient, ModelError } from "./errors";
import { chainFor, type ModelConfig, type ModelRole, type ModelSpec } from "./registry";

/**
 * Model router (IMPLEMENTATION.md Step 2.1):
 * - walks the role's chain (primary, then fallbacks), skipping models with no budget headroom;
 * - retries transient failures on the same model up to MAX_RETRIES times (honours `retry-after`);
 * - falls back to the next model ONLY before the first token; once text has streamed, an error
 *   ends the answer (with its partial text) instead of switching model mid-answer;
 * - logs one safe line per attempt: model, latency, retries, fallbackUsed, errorCategory.
 */
export const MAX_RETRIES = 2;
/** A 429 asking us to wait longer than this moves on to the next model instead of waiting. */
export const MAX_RETRY_AFTER_MS = 5_000;

export interface RouterDeps {
  kv: KV;
  config: ModelConfig;
  languageModel: (id: string) => LanguageModel;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  now?: () => number;
}

export interface CallInfo {
  model: string;
  fallbackUsed: boolean;
  retries: number;
}

interface WalkOptions {
  role: ModelRole;
  estTokens: number;
  purpose: string;
  signal?: AbortSignal;
}

function defaultSleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new ModelError({ category: "aborted" }));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new ModelError({ category: "aborted" }));
      },
      { once: true },
    );
  });
}

const backoff = (attempt: number) => 250 * 2 ** attempt + Math.floor(Math.random() * 150);

/** Shared chain walk. `attempt` throws (any error) when the call fails before producing output. */
async function walk<T>(
  deps: RouterDeps,
  opts: WalkOptions,
  attempt: (spec: ModelSpec, model: LanguageModel) => Promise<T>,
): Promise<{ value: T } & CallInfo> {
  const sleep = deps.sleep ?? defaultSleep;
  const now = deps.now ?? Date.now;
  const chain = chainFor(opts.role, deps.config);
  let lastError: ModelError | null = null;
  let tried = 0;

  for (const [index, spec] of chain.entries()) {
    if (!(await hasHeadroom(deps.kv, spec.id, opts.estTokens))) {
      logger.info("model.skip", { purpose: opts.purpose, model: spec.id, reason: "no_headroom" });
      continue;
    }
    tried++;
    for (let retries = 0; ; retries++) {
      const started = now();
      const fallbackUsed = index > 0;
      try {
        const value = await attempt(spec, deps.languageModel(spec.id));
        logger.info("model.call", {
          purpose: opts.purpose,
          model: spec.id,
          latencyMs: now() - started,
          retries,
          fallbackUsed,
          errorCategory: null,
        });
        return { value, model: spec.id, fallbackUsed, retries };
      } catch (raw) {
        const err = opts.signal?.aborted ? new ModelError({ category: "aborted" }) : classifyError(raw);
        logger.warn("model.call", {
          purpose: opts.purpose,
          model: spec.id,
          latencyMs: now() - started,
          retries,
          fallbackUsed,
          errorCategory: err.category,
          status: err.status ?? null,
        });
        if (err.category === "aborted") throw err;
        lastError = new ModelError({ ...err, category: err.category, model: spec.id, message: err.message });

        const waitable = err.category !== "rate_limit" || (err.retryAfterMs ?? Infinity) <= MAX_RETRY_AFTER_MS;
        if (isTransient(err.category) && waitable && retries < MAX_RETRIES) {
          await sleep(err.category === "rate_limit" ? err.retryAfterMs! : backoff(retries), opts.signal);
          continue;
        }
        if (err.category === "rate_limit") await markExhausted(deps.kv, spec.id, err.retryAfterMs, now());
        if (allowsFallback(err.category)) break; // next model
        throw lastError; // 400 / 401 / 413 / unknown: no retry, no fallback
      }
    }
  }

  if (tried === 0) {
    // Every model was skipped for lack of budget: tell the user when capacity returns.
    const resets = await Promise.all(chain.map((s) => getBudget(deps.kv, s.id)));
    const earliest = resets
      .map((b) => (b ? Date.parse(b.resetAt) : NaN))
      .filter((t) => !Number.isNaN(t))
      .sort((a, b) => a - b)[0];
    throw new CapacityError(new Date(earliest ?? now() + 60_000));
  }
  throw lastError ?? new ModelError({ category: "unknown" });
}

/** Non-streaming calls (router chain, summaries, titles). */
export async function generateWithFallback<T>(
  deps: RouterDeps,
  opts: WalkOptions,
  call: (model: LanguageModel, spec: ModelSpec) => Promise<T>,
) {
  return walk(deps, opts, (spec, model) => call(model, spec));
}

type Part = TextStreamPart<ToolSet>;

export interface RoutedStream extends CallInfo {
  /** ms from the start of the successful attempt to its first text/reasoning token. */
  firstTokenMs: number;
  /**
   * Text/reasoning/finish parts. After the first token, an error or abort is thrown as a
   * ModelError whose `partialText` holds the text streamed so far (never a fallback).
   */
  parts: AsyncIterable<Part>;
  usage: () => Promise<LanguageModelUsage | undefined>;
}

export interface StreamStart {
  stream: AsyncIterable<Part>;
  usage: PromiseLike<LanguageModelUsage>;
}

/**
 * A provider stream that ends without a real finish reason ("other"/"error") was cut off: the final
 * chunk with `finish_reason` never arrived. The AI SDK reports this as an ordinary `finish`, so the
 * router turns it into a network error (otherwise a truncated answer would be saved as complete).
 */
const isTruncated = (p: Part) =>
  p.type === "finish" && (p.finishReason === "other" || p.finishReason === "error");
const dropped = () => new ModelError({ category: "network", message: "Stream ended without a finish reason" });

const isToken = (p: Part) =>
  (p.type === "text-delta" && p.text.length > 0) || (p.type === "reasoning-delta" && p.text.length > 0);

/**
 * Streaming calls (the tutor). `start` must call `streamText({ model, maxRetries: 0, abortSignal })`
 * and return `{ stream: result.stream, usage: result.usage }`.
 */
export async function streamWithFallback(
  deps: RouterDeps,
  opts: WalkOptions,
  start: (model: LanguageModel, spec: ModelSpec) => StreamStart,
): Promise<RoutedStream> {
  const now = deps.now ?? Date.now;
  const { value, ...info } = await walk(deps, opts, async (spec, model) => {
    const started = now();
    const res = start(model, spec);
    const it = res.stream[Symbol.asyncIterator]();
    const buffered: Part[] = [];
    // Read until the first real token: errors before it are retryable / allow fallback.
    for (;;) {
      const { done, value: part } = await it.next();
      if (done) break;
      if (part.type === "error") throw part.error;
      if (part.type === "abort") throw new ModelError({ category: "aborted" });
      if (isTruncated(part)) throw dropped();
      buffered.push(part);
      if (isToken(part) || part.type === "finish") break;
    }
    return { it, buffered, firstTokenMs: now() - started, usage: res.usage, spec };
  });

  const { it, buffered, firstTokenMs, usage } = value;
  let partial = "";
  const signal = opts.signal;

  async function* parts(): AsyncGenerator<Part> {
    const track = (p: Part) => {
      if (p.type === "text-delta") partial += p.text;
    };
    for (const p of buffered) {
      track(p);
      yield p;
    }
    try {
      for (;;) {
        const { done, value: part } = await it.next();
        if (done) return;
        if (part.type === "error") throw part.error;
        if (part.type === "abort") throw new ModelError({ category: "aborted" });
        if (isTruncated(part)) throw dropped();
        track(part);
        yield part;
      }
    } catch (raw) {
      const err = signal?.aborted ? new ModelError({ category: "aborted" }) : classifyError(raw);
      // Mid-stream failures after tokens are reported as network drops unless clearly something else.
      const category = err.category === "unknown" ? "network" : err.category;
      logger.warn("model.stream_error", {
        purpose: opts.purpose,
        model: info.model,
        retries: info.retries,
        fallbackUsed: info.fallbackUsed,
        errorCategory: category,
        partialChars: partial.length,
      });
      throw new ModelError({ category, partialText: partial, model: info.model, status: err.status });
    }
  }

  return {
    ...info,
    firstTokenMs,
    parts: parts(),
    usage: async () => {
      try {
        return await usage;
      } catch {
        return undefined;
      }
    },
  };
}
