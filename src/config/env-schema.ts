/**
 * Environment schema — single source of truth for every variable the app reads.
 *
 * Pure module (no secrets, no "server-only") so it can be imported by
 * next.config.ts (fail fast at `next dev` / `next build`) and by tests.
 * Runtime access goes through `src/server/env.ts`.
 *
 * Phase 1: service secrets are optional. `parseServerEnv(raw, { strict: true })`
 * requires them; Phase 2 turns strict mode on for the services it adds.
 */
import { z } from "zod";

const bool = z
  .enum(["true", "false", "1", "0"])
  .default("false")
  .transform((v) => v === "true" || v === "1");

const positiveInt = (fallback: number) => z.coerce.number().int().positive().default(fallback);

/** Variables that become required once their service is wired in (strict mode). */
export const SECRET_KEYS = [
  "DATABASE_URL",
  "DATABASE_URL_UNPOOLED",
  "CLERK_SECRET_KEY",
  "CLERK_WEBHOOK_SIGNING_SECRET",
  "GROQ_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "BLOB_READ_WRITE_TOKEN",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "ANON_COOKIE_SECRET",
  "CRON_SECRET",
  "INTERNAL_JOB_SECRET",
] as const;

const optionalSecret = z.string().min(1).optional();

export const serverShape = {
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Services (secrets) — optional in Phase 1
  DATABASE_URL: optionalSecret,
  DATABASE_URL_UNPOOLED: optionalSecret,
  CLERK_SECRET_KEY: optionalSecret,
  CLERK_WEBHOOK_SIGNING_SECRET: optionalSecret,
  GROQ_API_KEY: optionalSecret,
  GOOGLE_GENERATIVE_AI_API_KEY: optionalSecret,
  BLOB_READ_WRITE_TOKEN: optionalSecret,
  UPSTASH_REDIS_REST_URL: z.url().optional(),
  UPSTASH_REDIS_REST_TOKEN: optionalSecret,
  ANON_COOKIE_SECRET: z.string().min(32).optional(),
  CRON_SECRET: optionalSecret,
  INTERNAL_JOB_SECRET: optionalSecret,
  OPENAI_API_KEY: optionalSecret,

  // Local / test infrastructure (never set on Vercel)
  /** Folder for an embedded PGlite database when DATABASE_URL is not set (local dev, e2e). */
  PGLITE_DIR: z.string().min(1).optional(),
  /** "groq" needs GROQ_API_KEY; "mock" replays the scripted demo tutor. Default: groq if a key is set. */
  LLM_MODE: z.enum(["groq", "mock"]).optional(),
  /** ms per token for the mock tutor (e2e uses 1). */
  MOCK_LLM_DELAY_MS: z.coerce.number().int().min(0).default(20),
  /** E2E only: ms per passage for the offline hash embeddings, so live progress can be seen. Never on Vercel. */
  MOCK_EMBED_DELAY_MS: z.coerce.number().int().min(0).max(5_000).default(0),
  /** E2E only: sign in through a signed test cookie instead of Clerk. Refused on Vercel. */
  E2E_TEST_AUTH: bool,

  // Models (IDs are config, never hardcoded in logic)
  EMBEDDING_MODEL: z.string().default("gemini-embedding-001"),
  /** The chunk column is halfvec(768): other sizes need a migration. */
  EMBEDDING_DIM: z.coerce.number().int().pipe(z.literal(768)).default(768),
  /** "gemini" needs GOOGLE_GENERATIVE_AI_API_KEY; "hash" = offline lexical embeddings. Default: gemini if a key is set. */
  EMBEDDINGS_MODE: z.enum(["gemini", "hash"]).optional(),
  /** Gemini free tier: 100 embedding requests a minute, one per passage. Ingestion paces itself at this rate, leaving room for chat questions. */
  EMBEDDING_REQUESTS_PER_MINUTE: z.coerce.number().int().min(1).max(10_000).default(95),
  /** Folder for uploaded PDFs when BLOB_READ_WRITE_TOKEN is not set (local dev, tests). Never on Vercel. */
  LOCAL_BLOB_DIR: z.string().min(1).optional(),
  /**
   * Ordered fallback chain for every model call: the first model that answers wins.
   * Comma separated (ids contain "/"). Classifier models (llama-prompt-guard) are skipped.
   */
  MODEL_CHAIN: z
    .string()
    .default("qwen/qwen3.8-27b,openai/gpt-oss-120b,openai/gpt-oss-20b,openai/gpt-oss-safeguard-20b")
    .refine((v) => v.split(/[\s,;]+/).some(Boolean), "must list at least one model id"),

  // Feature flags
  ENABLE_OCR: bool,
  ENABLE_PROMPT_GUARD: bool,
  ENABLE_DEV_PAGES: bool,

  // Limits
  UPLOAD_QUOTA_PER_WEEK: positiveInt(3),
  MAX_ACTIVE_DOCUMENTS: positiveInt(5),
  MAX_PDF_SIZE_MB: positiveInt(10),
  MAX_PDF_PAGES: positiveInt(300),
  RETAIN_PDF: bool,
  GUEST_MAX_TURNS_PER_THREAD: positiveInt(6),
  GUEST_MAX_THREADS_PER_DAY: positiveInt(3),
  USER_MAX_MESSAGES_PER_DAY: positiveInt(50),
} as const;

export const clientShape = {
  NEXT_PUBLIC_APP_URL: z.url().optional(),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: z.string().default("/sign-in"),
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: z.string().default("/sign-up"),
} as const;

export const ENV_KEYS = [...Object.keys(serverShape), ...Object.keys(clientShape)].filter(
  (k) => k !== "NODE_ENV",
);

export type ServerEnv = z.infer<z.ZodObject<typeof serverShape>>;
export type ClientEnv = z.infer<z.ZodObject<typeof clientShape>>;

/** Turn Zod issues into one readable message that names every bad variable. */
export function formatEnvIssues(issues: readonly { path: readonly PropertyKey[]; message: string }[]) {
  const lines = issues.map((i) => `  - ${String(i.path[0] ?? "(root)")}: ${i.message}`);
  return `Invalid environment variables:\n${lines.join("\n")}`;
}

type RawEnv = Record<string, string | undefined>;

/** Empty strings are treated as "unset", like `emptyStringAsUndefined` in t3-env. */
function clean(raw: RawEnv): RawEnv {
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v === "" ? undefined : v]));
}

/** Test-only auth must never be switched on in a Vercel deployment. */
export function assertNoTestAuthOnVercel(raw: RawEnv) {
  const on = raw.E2E_TEST_AUTH === "true" || raw.E2E_TEST_AUTH === "1";
  if (on && (raw.VERCEL || raw.VERCEL_ENV))
    throw new Error(formatEnvIssues([{ path: ["E2E_TEST_AUTH"], message: "must not be set on Vercel" }]));
}

export function parseServerEnv(raw: RawEnv, opts: { strict?: boolean } = {}): ServerEnv {
  assertNoTestAuthOnVercel(raw);
  let schema = z.object(serverShape);
  if (opts.strict) {
    const required = Object.fromEntries(
      SECRET_KEYS.map((k) => [k, k === "UPSTASH_REDIS_REST_URL" ? z.url() : z.string().min(1)]),
    );
    schema = schema.extend(required) as unknown as typeof schema;
  }
  const result = schema.safeParse(clean(raw));
  if (!result.success) throw new Error(formatEnvIssues(result.error.issues));
  return result.data;
}

export function parseClientEnv(raw: RawEnv): ClientEnv {
  const result = z.object(clientShape).safeParse(clean(raw));
  if (!result.success) throw new Error(formatEnvIssues(result.error.issues));
  return result.data;
}

/** Validate everything (called from next.config.ts so bad config stops `next dev` / `next build`). */
export function validateEnvAtStartup(raw: RawEnv = process.env) {
  parseServerEnv(raw);
  parseClientEnv(raw);
}
