import "server-only";

import type { LanguageModel } from "ai";

import { pickScript } from "@/lib/mock/scripts";

/**
 * Offline stand-in for a Groq model (LLM_MODE=mock: no key, local dev, e2e). It replays the
 * scripted demo answers token by token through the real AI SDK path, so the orchestrator,
 * persistence and limits run exactly as they do with Groq.
 */
type Model = Exclude<LanguageModel, string>;
type CallOptions = Parameters<Model["doStream"]>[0];

export function tokenize(text: string): string[] {
  return text.match(/\s+|[^\s]{1,4}/g) ?? [];
}

function lastUserText(options: CallOptions): string {
  for (let i = options.prompt.length - 1; i >= 0; i--) {
    const m = options.prompt[i]!;
    if (m.role === "user")
      return m.content
        .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
        .map((p) => p.text)
        .join("");
  }
  return "";
}

const usage = (input: number, output: number) => ({
  inputTokens: { total: input, noCache: input, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: output, text: output, reasoning: undefined },
});

export function createMockModel(modelId: string, delayMs: number): Model {
  return {
    specificationVersion: "v4",
    provider: "mock",
    modelId,
    supportedUrls: {},
    async doGenerate() {
      return {
        content: [{ type: "text", text: "Physics conversation" }],
        finishReason: { unified: "stop", raw: "stop" },
        usage: usage(20, 3),
        warnings: [],
      };
    },
    async doStream(options) {
      const script = pickScript(lastUserText(options));
      const signal = options.abortSignal;
      const wait = () =>
        new Promise<void>((resolve, reject) => {
          if (signal?.aborted) return reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
          setTimeout(resolve, delayMs);
        });
      const text = tokenize(script.text);
      const reasoning = script.reasoning ? tokenize(script.reasoning) : [];
      const stream = new ReadableStream({
        async start(c) {
          try {
            c.enqueue({ type: "stream-start", warnings: [] });
            if (reasoning.length) {
              c.enqueue({ type: "reasoning-start", id: "r0" });
              for (const t of reasoning) {
                await wait();
                c.enqueue({ type: "reasoning-delta", id: "r0", delta: t });
              }
              c.enqueue({ type: "reasoning-end", id: "r0" });
            }
            c.enqueue({ type: "text-start", id: "t0" });
            for (const t of text) {
              await wait();
              c.enqueue({ type: "text-delta", id: "t0", delta: t });
            }
            c.enqueue({ type: "text-end", id: "t0" });
            c.enqueue({ type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage: usage(120, text.length) });
            c.close();
          } catch (err) {
            c.error(err);
          }
        },
      });
      return { stream };
    },
  } as Model;
}
