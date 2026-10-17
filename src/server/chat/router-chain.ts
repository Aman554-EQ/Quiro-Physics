import "server-only";

import { generateText, Output } from "ai";
import { z } from "zod";

import { pickScript } from "@/lib/mock/scripts";
import type { Llm } from "@/server/llm";
import { logger } from "@/server/log";
import { generateWithFallback } from "@/server/models/router";

import { buildRouterPrompt } from "./prompts";
import { estimateTokens } from "./tokens";

/** Router output (PROMPTS.md §2). */
export const RouteSchema = z.object({
  scope: z.enum(["physics", "physics_math", "study_meta", "greeting", "off_topic", "unsafe"]),
  queryType: z.enum(["concept", "numerical", "derivation", "textbook_lookup", "follow_up", "mixed"]),
  difficulty: z.coerce.number().int().min(1).max(5),
  needsRetrieval: z.boolean(),
  standaloneQuestion: z.string().trim().min(1).max(2000),
  // Every field is required: Groq strict JSON-schema mode rejects schemas with optional keys.
  language: z.string().max(12),
});
export type Route = z.infer<typeof RouteSchema>;

export const ROUTER_TIMEOUT_MS = 6_000;

export interface RouterInput {
  message: string;
  /** Recent turns as "Learner: …\nTutor: …" text (no reasoning). */
  recent: string;
  summary: string;
  documentTitles: string[];
  signal?: AbortSignal;
  /** Overall deadline for the router call (default ROUTER_TIMEOUT_MS). */
  timeoutMs?: number;
}

export interface RouterResult {
  route: Route;
  /** null when the safe fallback was used (parse failure, timeout, provider error) or in mock mode. */
  model: string | null;
  fallbackUsed: boolean;
  retries: number;
  latencyMs: number;
  promptTokens: number | null;
  completionTokens: number | null;
  usedFallbackRoute: boolean;
}

/** Wrongly blocking a physics question is worse than letting a borderline one through. */
export function fallbackRoute(message: string, hasDocs: boolean): Route {
  return {
    scope: "physics",
    queryType: "concept",
    difficulty: 2,
    needsRetrieval: hasDocs,
    standaloneQuestion: message,
    language: "en",
  };
}

const GREETING = /^\s*(hi|hello|hey|hiya|good (morning|afternoon|evening)|thanks|thank you)\b[!.\s]*$/i;
const UNSAFE = /\b(bomb|explosive|weapon|nerve agent|poison (someone|a person)|hurt (someone|people))\b/i;

/** Mock mode (no key): keyword routing that mirrors the demo tutor's scripts. */
export function heuristicRoute(message: string): Route {
  if (UNSAFE.test(message)) return { ...fallbackRoute(message, false), scope: "unsafe" };
  if (GREETING.test(message)) return { ...fallbackRoute(message, false), scope: "greeting" };
  const script = pickScript(message);
  if (script.id === "off_topic") return { ...fallbackRoute(message, false), scope: "off_topic" };
  return {
    ...fallbackRoute(message, false),
    queryType: script.route.queryType,
    difficulty: script.id === "numerical" || script.id === "derivation" ? 3 : 2,
    needsRetrieval: script.route.usingTextbook,
  };
}

/** One cheap structured call: scope, query type, difficulty, retrieval need, standalone rewrite. */
export async function runRouterChain(llm: Llm, input: RouterInput): Promise<RouterResult> {
  const started = Date.now();
  const hasDocs = input.documentTitles.length > 0;
  if (llm.mode === "mock")
    return {
      route: heuristicRoute(input.message),
      model: null,
      fallbackUsed: false,
      retries: 0,
      latencyMs: 0,
      promptTokens: null,
      completionTokens: null,
      usedFallbackRoute: false,
    };

  const prompt = buildRouterPrompt(input);
  const deadline = AbortSignal.timeout(input.timeoutMs ?? ROUTER_TIMEOUT_MS);
  const signal = input.signal ? AbortSignal.any([input.signal, deadline]) : deadline;
  try {
    const res = await generateWithFallback(
      llm.deps,
      { role: "router", estTokens: estimateTokens(prompt) + 200, purpose: "router", signal },
      (model, spec) =>
        generateText({
          model,
          prompt,
          output: Output.object({ schema: RouteSchema }),
          temperature: 0,
          maxOutputTokens: 1_000, // includes reasoning tokens on gpt-oss
          maxRetries: 0,
          abortSignal: signal,
          providerOptions: { groq: { structuredOutputs: spec.supportsJsonSchema } },
          ...(spec.supportsReasoning ? { reasoning: "low" as const } : {}), // classification: keep it fast
        }),
    );
    return {
      route: res.value.output,
      model: res.model,
      fallbackUsed: res.fallbackUsed,
      retries: res.retries,
      latencyMs: Date.now() - started,
      promptTokens: res.value.usage.inputTokens ?? null,
      completionTokens: res.value.usage.outputTokens ?? null,
      usedFallbackRoute: false,
    };
  } catch (err) {
    if (input.signal?.aborted) throw err;
    logger.warn("router.fallback_route", { reason: (err as Error)?.name ?? "unknown" });
    return {
      route: fallbackRoute(input.message, hasDocs),
      model: null,
      fallbackUsed: false,
      retries: 0,
      latencyMs: Date.now() - started,
      promptTokens: null,
      completionTokens: null,
      usedFallbackRoute: true,
    };
  }
}
