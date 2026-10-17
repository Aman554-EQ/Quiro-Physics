import "server-only";

import { Embeddings } from "@langchain/core/embeddings";

import { env } from "@/server/env";
import { parseRetryAfter } from "@/server/models/errors";

/**
 * Embeddings (RAG_PIPELINE.md §4). LangChain `Embeddings` so retrievers and tools can use them.
 * - GeminiEmbeddings: `gemini-embedding-001`, 768 dims, task types, L2-normalised after truncation.
 * - HashEmbeddings: offline lexical embeddings (feature hashing of word stems and bigrams). Used when
 *   there is no Google key, and in tests: deterministic, free, good enough for exact-term matches.
 * Vectors of different models are never mixed: each document records the model it was embedded with.
 */
export const EMBEDDING_DIM = 768;
export const HASH_EMBEDDING_MODEL = "hash-embedding@1";
export const GEMINI_BATCH = 32;

export class EmbeddingRateLimitError extends Error {
  constructor(
    readonly retryAfterMs: number,
    /** The daily quota is used up (not the per-minute one): waiting in the slice is pointless. */
    readonly daily = false,
  ) {
    super("Embedding rate limited");
    this.name = "EmbeddingRateLimitError";
  }
}

/**
 * Gemini's 429 body says how long to wait ("Please retry in 22.48s", RetryInfo `retryDelay: "22s"`)
 * and which quota ran out (quotaId `…PerDay…` or `…PerMinute…`). There is no Retry-After header,
 * so without this the job guessed 10 s and hit the limit again.
 */
export function parseGeminiRateLimit(body: string, header: string | null): { retryAfterMs: number; daily: boolean } {
  const daily = /PerDay/i.test(body);
  const fromHeader = parseRetryAfter(header);
  const delay = body.match(/"retryDelay"\s*:\s*"([\d.]+)s"/)?.[1] ?? body.match(/retry in ([\d.]+)\s*s/i)?.[1];
  const fromBody = delay ? Math.ceil(Number(delay) * 1000) : undefined;
  return { retryAfterMs: fromHeader ?? fromBody ?? (daily ? 3_600_000 : 30_000), daily };
}

/**
 * Requests in the last minute, per model (each passage is one request on Gemini's free tier:
 * 100 a minute). Ingestion paces itself below the limit instead of running into 429s, and chat
 * queries are counted too, so a learner's question during indexing still gets an embedding.
 */
export class RequestWindow {
  private stamps: number[] = [];
  constructor(readonly perMinute: number) {}
  private trim(now: number) {
    while (this.stamps.length && this.stamps[0]! <= now - 60_000) this.stamps.shift();
  }
  /** How long to wait before `n` more requests fit (0 = now). */
  waitMs(n: number, now: number) {
    this.trim(now);
    const over = this.stamps.length + n - this.perMinute;
    if (over <= 0) return 0;
    return Math.max(0, this.stamps[Math.min(over, this.stamps.length) - 1]! + 60_000 - now);
  }
  record(n: number, now: number) {
    for (let i = 0; i < n; i++) this.stamps.push(now);
  }
  /** After a 429: treat the window as full until `until`. */
  block(until: number) {
    this.stamps = Array.from({ length: this.perMinute }, () => until - 60_000);
  }
}

const windows = new Map<string, RequestWindow>();
export function requestWindow(modelId: string, perMinute: number) {
  let w = windows.get(modelId);
  if (!w || w.perMinute !== perMinute) windows.set(modelId, (w = new RequestWindow(perMinute)));
  return w;
}

export class EmbeddingError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "EmbeddingError";
  }
}

export function l2normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return norm > 0 ? v.map((x) => x / norm) : v;
}

export interface PhysicsEmbeddings extends Embeddings {
  readonly modelId: string;
  /** Requests per minute the provider allows (unset: no limit, e.g. offline hash embeddings). */
  readonly requestsPerMinute?: number;
}

// ---------- Gemini ----------
type TaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

export class GeminiEmbeddings extends Embeddings implements PhysicsEmbeddings {
  readonly modelId: string;
  readonly requestsPerMinute: number;
  constructor(
    private readonly opts: { apiKey: string; model?: string; fetch?: typeof fetch; baseUrl?: string; requestsPerMinute?: number },
  ) {
    super({ maxRetries: 0 });
    this.modelId = opts.model ?? "gemini-embedding-001";
    this.requestsPerMinute = opts.requestsPerMinute ?? 95;
  }

  embedDocuments(texts: string[]) {
    return this.call(texts, "RETRIEVAL_DOCUMENT");
  }

  async embedQuery(text: string) {
    return (await this.call([text], "RETRIEVAL_QUERY"))[0]!;
  }

  private async call(texts: string[], taskType: TaskType): Promise<number[][]> {
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += GEMINI_BATCH) {
      const batch = texts.slice(i, i + GEMINI_BATCH);
      const base = this.opts.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta";
      const res = await (this.opts.fetch ?? globalThis.fetch)(`${base}/models/${this.modelId}:batchEmbedContents`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": this.opts.apiKey },
        body: JSON.stringify({
          requests: batch.map((text) => ({
            model: `models/${this.modelId}`,
            content: { parts: [{ text }] },
            taskType,
            outputDimensionality: EMBEDDING_DIM,
          })),
        }),
      });
      // Ingestion paces and records its own requests (embed stage); chat queries are counted here.
      const window = taskType === "RETRIEVAL_QUERY" ? requestWindow(this.modelId, this.requestsPerMinute) : null;
      if (res.status === 429) {
        const limit = parseGeminiRateLimit(await res.text().catch(() => ""), res.headers.get("retry-after"));
        window?.block(Date.now() + limit.retryAfterMs);
        throw new EmbeddingRateLimitError(limit.retryAfterMs, limit.daily);
      }
      window?.record(batch.length, Date.now());
      if (!res.ok) throw new EmbeddingError(`Embedding request failed (${res.status})`, res.status);
      const body = (await res.json()) as { embeddings?: { values: number[] }[] };
      const vectors = body.embeddings?.map((e) => e.values) ?? [];
      if (vectors.length !== batch.length || vectors.some((v) => v.length !== EMBEDDING_DIM))
        throw new EmbeddingError("Embedding response had the wrong shape");
      // Truncated (Matryoshka) vectors are not unit length: re-normalise (RAG_PIPELINE.md §4).
      out.push(...vectors.map(l2normalize));
    }
    return out;
  }
}

// ---------- Offline hash embeddings ----------
const STOP = new Set(
  "a an and are as at be by for from has have how in is it its of on or that the this to was were what when where which why with does do can i you we".split(
    " ",
  ),
);

/** Very small stemmer: plural and common suffixes, so "forces"/"force" and "moving"/"move" meet. */
export function stem(w: string) {
  if (w.length <= 3) return w;
  return w
    .replace(/(ies)$/, "y")
    .replace(/(sses)$/, "ss")
    .replace(/([^s])s$/, "$1")
    .replace(/(ing|ed)$/, "")
    .replace(/(ational)$/, "ate");
}

export function lexicalTerms(text: string): string[] {
  const words = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}^_]+/gu, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w))
    .map(stem);
  const terms = [...words];
  for (let i = 0; i + 1 < words.length; i++) terms.push(`${words[i]} ${words[i + 1]}`);
  return terms;
}

function fnv1a(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function hashEmbed(text: string): number[] {
  const v = new Array<number>(EMBEDDING_DIM).fill(0);
  const tf = new Map<string, number>();
  for (const t of lexicalTerms(text)) tf.set(t, (tf.get(t) ?? 0) + 1);
  for (const [term, n] of tf) {
    const h = fnv1a(term);
    const weight = (1 + Math.log(n)) * (term.includes(" ") ? 0.6 : 1);
    v[h % EMBEDDING_DIM]! += (h & 0x80000000 ? -1 : 1) * weight;
  }
  return l2normalize(v);
}

export class HashEmbeddings extends Embeddings implements PhysicsEmbeddings {
  readonly modelId: string = HASH_EMBEDDING_MODEL;
  constructor() {
    super({});
  }
  async embedDocuments(texts: string[]) {
    return texts.map(hashEmbed);
  }
  async embedQuery(text: string) {
    return hashEmbed(text);
  }
}

/** E2E: hash embeddings that take `delayMs` per passage, so the Library shows live progress. */
class SlowHashEmbeddings extends HashEmbeddings {
  constructor(private readonly delayMs: number) {
    super();
  }
  override async embedDocuments(texts: string[]) {
    await new Promise((r) => setTimeout(r, this.delayMs * texts.length));
    return super.embedDocuments(texts);
  }
}

// ---------- Selection ----------
let override: PhysicsEmbeddings | null = null;

/** The embeddings in use: Gemini with a key (or EMBEDDINGS_MODE=gemini), otherwise hash. */
export function getEmbeddings(): PhysicsEmbeddings {
  if (override) return override;
  const mode = env.EMBEDDINGS_MODE ?? (env.GOOGLE_GENERATIVE_AI_API_KEY ? "gemini" : "hash");
  if (mode === "gemini") {
    if (!env.GOOGLE_GENERATIVE_AI_API_KEY) throw new Error("EMBEDDINGS_MODE=gemini needs GOOGLE_GENERATIVE_AI_API_KEY");
    return new GeminiEmbeddings({
      apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY,
      model: env.EMBEDDING_MODEL,
      requestsPerMinute: env.EMBEDDING_REQUESTS_PER_MINUTE,
    });
  }
  return env.MOCK_EMBED_DELAY_MS ? new SlowHashEmbeddings(env.MOCK_EMBED_DELAY_MS) : new HashEmbeddings();
}

export function setEmbeddingsForTests(e: PhysicsEmbeddings | null) {
  override = e;
}
