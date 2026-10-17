import "server-only";

import { generateText } from "ai";

import { setAutoTitle } from "@/server/db/queries/conversations";
import type { Db } from "@/server/db";
import type { Llm } from "@/server/llm";
import { generateWithFallback } from "@/server/models/router";

import { TITLE_INSTRUCTIONS } from "./prompts";

/** 2 to 6 words, no quotes, no trailing punctuation (title@1). */
export function cleanTitle(raw: string, fallback: string): string {
  const words = raw
    .replace(/["“”`*#]/g, "")
    // Quotes around words go; apostrophes inside them ("Newton's") stay.
    .replace(/(^|\s)['‘’]+|['‘’]+(?=\s|$)/g, "$1")
    .replace(/^title:\s*/i, "")
    .replace(/[.!?:;,\s]+$/, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6);
  if (words.length === 0) return fallbackTitle(fallback);
  return words.join(" ").slice(0, 80);
}

/** No model available: the first words of the question. */
export function fallbackTitle(question: string) {
  return cleanTitle(question.replace(/\$[^$]*\$/g, "").split(/[.?!\n]/)[0] ?? question, "New chat") || "New chat";
}

/** Title the conversation after its first exchange, unless the user has already renamed it. */
export async function generateTitle(llm: Llm, db: Db, ids: { userId: string; conversationId: string }, question: string) {
  let title = fallbackTitle(question);
  if (llm.mode === "groq") {
    try {
      const res = await generateWithFallback(llm.deps, { role: "summary", estTokens: 300, purpose: "title" }, (model, spec) =>
        generateText({
          model,
          ...(spec.supportsReasoning ? { reasoning: "low" as const } : {}),
          prompt: `${TITLE_INSTRUCTIONS}\n\nFirst question: ${question.slice(0, 600)}`,
          temperature: 0.2,
          maxOutputTokens: 300, // reasoning models spend part of this on thinking
          maxRetries: 0,
        }),
      );
      title = cleanTitle(res.value.text, question);
    } catch {
      // keep the fallback title
    }
  }
  await setAutoTitle(db, ids.userId, ids.conversationId, title);
  return title;
}
