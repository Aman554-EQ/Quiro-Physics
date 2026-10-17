import "server-only";

import { env } from "@/server/env";
import { getKV } from "@/server/kv";
import { logger } from "@/server/log";
import { createBudgetedGroq } from "@/server/models/groq";
import type { RouterDeps } from "@/server/models/router";

import { processSingleton } from "../singleton";

import { createMockModel } from "./mock-model";

export interface Llm {
  /** "mock" replays the scripted demo tutor (no key needed). */
  mode: "groq" | "mock";
  deps: RouterDeps;
}

const slot = processSingleton<Llm>("llm");
/** The `env` the current instance was built from, or "test" for one injected by setLlmForTests. */
const builtFrom = processSingleton<object | "test">("llm-built-from");

export function getLlm(): Llm {
  const existing = slot.get();
  // The slot outlives hot reloads; a new `env` (edited .env.local, changed schema) means rebuild,
  // otherwise the old config would keep serving (e.g. without MODEL_CHAIN).
  const from = builtFrom.get();
  if (existing && (from === "test" || from === env)) return existing;
  let instance: Llm;
  const kv = getKV();
  const mode = env.LLM_MODE ?? (env.GROQ_API_KEY ? "groq" : "mock");
  if (mode === "groq") {
    if (!env.GROQ_API_KEY) throw new Error("LLM_MODE=groq needs GROQ_API_KEY");
    const groq = createBudgetedGroq({ apiKey: env.GROQ_API_KEY, kv });
    instance = { mode, deps: { kv, config: env, languageModel: (id) => groq(id) } };
  } else {
    if (env.NODE_ENV === "production" && !process.env.E2E)
      logger.warn("llm.mock_mode", { reason: "GROQ_API_KEY not set: answers come from the demo tutor" });
    instance = {
      mode,
      deps: { kv, config: env, languageModel: (id) => createMockModel(id, env.MOCK_LLM_DELAY_MS) },
    };
  }
  builtFrom.set(env);
  slot.set(instance);
  return instance;
}

export function setLlmForTests(llm: Llm | null) {
  slot.set(llm ?? undefined);
  builtFrom.set(llm ? "test" : undefined);
}
