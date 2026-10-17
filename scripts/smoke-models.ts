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

const roles = ["router", "tutorComplex", "tutorSimple", "guest", "summary"] as const;
for (const role of roles) {
  const chain = chainFor(role, env).map((m) => m.id);
  const started = Date.now();
  try {
    const res = await streamWithFallback(deps, { role, estTokens: 200, purpose: "smoke" }, (model) => {
      const r = streamText({ model, prompt: "In one sentence: what is Newton's second law?", maxRetries: 0 });
      return { stream: r.stream, usage: r.usage };
    });
    let text = "";
    for await (const p of res.parts) if (p.type === "text-delta") text += p.text;
    console.log(
      `${role.padEnd(13)} ${res.model.padEnd(26)} first token ${String(res.firstTokenMs).padStart(5)} ms · total ${Date.now() - started} ms · fallbackUsed: ${res.fallbackUsed}\n  chain: ${chain.join(" → ")}\n  "${text.trim().slice(0, 100)}"`,
    );
  } catch (e) {
    console.log(`${role.padEnd(13)} FAILED: ${(e as Error).message}  (chain: ${chain.join(" → ")})`);
  }
}
