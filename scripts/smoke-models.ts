// Manual check P2-S1-M01/M02: stream a short reply from every configured model, with real keys.
// Usage: pnpm smoke:models     (reads .env.local; needs GROQ_API_KEY)
import fs from "node:fs";

if (fs.existsSync(".env.local")) process.loadEnvFile(".env.local");

const { streamText } = await import("ai");
const { env } = await import("../src/server/env");
const { getKV } = await import("../src/server/kv");
const { createBudgetedGroq } = await import("../src/server/models/groq");
const { chainFor } = await import("../src/server/models/registry");
const { streamWithFallback } = await import("../src/server/models/router");

if (!env.GROQ_API_KEY) {
  console.error("GROQ_API_KEY is not set (.env.local).");
  process.exit(1);
}
const kv = getKV();
const groq = createBudgetedGroq({ apiKey: env.GROQ_API_KEY, kv });
const deps = { kv, config: env, languageModel: (id: string) => groq(id) };

// Every model of MODEL_CHAIN on its own (a one-model chain each), then the chain as the app walks it.
const chain = chainFor("tutorComplex", env).map((m) => m.id);
console.log(`MODEL_CHAIN (chat models, in order): ${chain.join(" → ")}\n`);
const ask = async (cfg: { MODEL_CHAIN: string }, label: string) => {
  const started = Date.now();
  try {
    const res = await streamWithFallback({ ...deps, config: cfg }, { role: "tutorComplex", estTokens: 200, purpose: "smoke" }, (model) => {
      const r = streamText({ model, prompt: "In one sentence: what is Newton's second law?", maxRetries: 0 });
      return { stream: r.stream, usage: r.usage };
    });
    let text = "";
    for await (const p of res.parts) if (p.type === "text-delta") text += p.text;
    console.log(
      `${label.padEnd(30)} ${res.model.padEnd(30)} first token ${String(res.firstTokenMs).padStart(5)} ms · total ${Date.now() - started} ms · fallbackUsed: ${res.fallbackUsed}\n  "${text.trim().slice(0, 100)}"`,
    );
  } catch (e) {
    console.log(`${label.padEnd(30)} FAILED: ${(e as Error).message}`);
  }
};
for (const id of chain) await ask({ MODEL_CHAIN: id }, id);
await ask(env, "full chain");
