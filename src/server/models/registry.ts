import "server-only";

/**
 * Model registry: which Groq model serves which role, and in what fallback order.
 * Model ids are configuration (env), never hardcoded in logic (techstack.md §3).
 */
export type ModelRole = "router" | "tutorComplex" | "tutorSimple" | "guest" | "summary";

export interface ModelSpec {
  id: string;
  provider: "groq";
  contextWindow: number;
  maxOutput: number;
  supportsReasoning: boolean;
  /** Groq structured outputs (json_schema). Others use JSON mode + Zod validation. */
  supportsJsonSchema: boolean;
  preview: boolean;
}

/** Known Groq models (Oct 2026). Unknown ids still work with conservative defaults. */
const KNOWN: Record<string, Omit<ModelSpec, "id" | "provider">> = {
  "openai/gpt-oss-120b": { contextWindow: 131_072, maxOutput: 32_766, supportsReasoning: true, supportsJsonSchema: true, preview: false },
  "openai/gpt-oss-20b": { contextWindow: 131_072, maxOutput: 32_766, supportsReasoning: true, supportsJsonSchema: true, preview: false },
  "llama-3.3-70b-versatile": { contextWindow: 131_072, maxOutput: 32_768, supportsReasoning: false, supportsJsonSchema: false, preview: false },
  "llama-3.1-8b-instant": { contextWindow: 131_072, maxOutput: 8_192, supportsReasoning: false, supportsJsonSchema: false, preview: false },
  "qwen/qwen3.8-27b": { contextWindow: 131_072, maxOutput: 40_960, supportsReasoning: true, supportsJsonSchema: false, preview: true },
};

export function specFor(id: string): ModelSpec {
  const known = KNOWN[id];
  return {
    id,
    provider: "groq",
    ...(known ?? { contextWindow: 32_768, maxOutput: 8_192, supportsReasoning: false, supportsJsonSchema: false, preview: false }),
  };
}

export interface ModelConfig {
  MODEL_ROUTER: string;
  MODEL_TUTOR_COMPLEX: string;
  MODEL_TUTOR_SIMPLE: string;
  MODEL_GUEST: string;
  MODEL_SUMMARY: string;
  MODEL_FALLBACKS: string;
  ENABLE_PREVIEW_MODELS: boolean;
}

const PRIMARY: Record<ModelRole, keyof ModelConfig> = {
  router: "MODEL_ROUTER",
  tutorComplex: "MODEL_TUTOR_COMPLEX",
  tutorSimple: "MODEL_TUTOR_SIMPLE",
  guest: "MODEL_GUEST",
  summary: "MODEL_SUMMARY",
};

/**
 * Primary model for the role, then MODEL_FALLBACKS in order; de-duplicated; preview models only
 * when ENABLE_PREVIEW_MODELS is on. (The primary is kept even if it is a preview model: choosing
 * it explicitly is an opt-in.)
 */
export function chainFor(role: ModelRole, cfg: ModelConfig): ModelSpec[] {
  const primary = String(cfg[PRIMARY[role]]).trim();
  const fallbacks = cfg.MODEL_FALLBACKS.split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((id) => cfg.ENABLE_PREVIEW_MODELS || !specFor(id).preview);
  const ids = [...new Set([primary, ...fallbacks].filter(Boolean))];
  return ids.map(specFor);
}
