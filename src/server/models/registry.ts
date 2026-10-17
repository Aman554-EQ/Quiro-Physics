import "server-only";

import { logger } from "@/server/log";

/**
 * Model registry: one ordered fallback chain (MODEL_CHAIN) shared by every role.
 * Model ids are configuration (env), never hardcoded in logic (techstack.md §3).
 */
export type ModelRole = "router" | "tutorComplex" | "tutorSimple" | "guest" | "summary";

export interface ModelSpec {
  id: string;
  provider: "groq";
  /** "classifier" models (Llama Prompt Guard) only score text: they can't stream or answer. */
  kind: "chat" | "classifier";
  contextWindow: number;
  maxOutput: number;
  supportsReasoning: boolean;
  /** Groq structured outputs (json_schema). Others use JSON mode + Zod validation. */
  supportsJsonSchema: boolean;
  preview: boolean;
}

type Known = Omit<ModelSpec, "id" | "provider">;

/** Known Groq models (probed on 2026-10-17). Unknown ids still work with conservative defaults. */
const KNOWN: Record<string, Known> = {
  "qwen/qwen3.8-27b": { kind: "chat", contextWindow: 131_072, maxOutput: 16_384, supportsReasoning: true, supportsJsonSchema: true, preview: true },
  "openai/gpt-oss-120b": { kind: "chat", contextWindow: 131_072, maxOutput: 65_536, supportsReasoning: true, supportsJsonSchema: true, preview: false },
  "openai/gpt-oss-20b": { kind: "chat", contextWindow: 131_072, maxOutput: 65_536, supportsReasoning: true, supportsJsonSchema: true, preview: false },
  "openai/gpt-oss-safeguard-20b": { kind: "chat", contextWindow: 131_072, maxOutput: 65_536, supportsReasoning: true, supportsJsonSchema: true, preview: false },
  "meta-llama/llama-prompt-guard-2-86m": { kind: "classifier", contextWindow: 512, maxOutput: 512, supportsReasoning: false, supportsJsonSchema: false, preview: false },
  "meta-llama/llama-prompt-guard-2-22m": { kind: "classifier", contextWindow: 512, maxOutput: 512, supportsReasoning: false, supportsJsonSchema: false, preview: false },
};

const UNKNOWN: Known = { kind: "chat", contextWindow: 32_768, maxOutput: 8_192, supportsReasoning: false, supportsJsonSchema: false, preview: false };

export function specFor(id: string): ModelSpec {
  return { id, provider: "groq", ...(KNOWN[id] ?? UNKNOWN) };
}

export interface ModelConfig {
  /** Ordered model ids, first = preferred. Separated by commas, semicolons, spaces or new lines. */
  MODEL_CHAIN: string;
}

/** Ids contain "/" (e.g. "openai/gpt-oss-20b"), so "/" can't separate them. */
export function parseModelChain(raw: string): string[] {
  return [...new Set(raw.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean))];
}

const warned = new Set<string>();

/**
 * The chat models of MODEL_CHAIN, in order, de-duplicated. Classifier models are skipped (logged
 * once): they would fail every chat call. Every role walks the same chain.
 */
export function chainFor(_role: ModelRole, cfg: ModelConfig): ModelSpec[] {
  const specs = parseModelChain(cfg.MODEL_CHAIN).map(specFor);
  for (const s of specs)
    if (s.kind !== "chat" && !warned.has(s.id)) {
      warned.add(s.id);
      logger.warn("model.chain_skip", { model: s.id, reason: "classifier models can't answer chat messages" });
    }
  return specs.filter((s) => s.kind === "chat");
}
