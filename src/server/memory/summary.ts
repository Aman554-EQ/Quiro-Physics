import "server-only";

import { generateText, Output } from "ai";
import { and, eq, gt, inArray, max } from "drizzle-orm";
import { z } from "zod";

import { conversationMemories, messages } from "@/db/schema";
import { SUMMARY_INSTRUCTIONS } from "@/server/chat/prompts";
import { estimateTokens } from "@/server/chat/tokens";
import type { Db } from "@/server/db";
import type { Llm } from "@/server/llm";
import { logger } from "@/server/log";
import { generateWithFallback } from "@/server/models/router";
import { PhysicsFactsSchema, type PhysicsFacts } from "@/shared/memory";

import { contextText, factsText } from "./context";

/**
 * Rolling summary + structured facts (MEMORY_SYSTEM.md §3, layers L2/L3). Runs in `after()` once
 * 4 turns (8 messages) are unsummarised. Summaries are derived data: invalid model output never
 * replaces good memory, and concurrent writers can't clobber each other (version check).
 */
export const SUMMARY_TRIGGER_MESSAGES = 8;

export const SummaryOutputSchema = z.object({
  summary: z.string().max(2_000),
  facts: PhysicsFactsSchema,
});

export function shouldSummarize(lastSeq: number, summarizedThroughSeq: number) {
  return lastSeq - summarizedThroughSeq >= SUMMARY_TRIGGER_MESSAGES;
}

export async function getMemory(db: Db, conversationId: string) {
  const [row] = await db
    .select()
    .from(conversationMemories)
    .where(eq(conversationMemories.conversationId, conversationId));
  return row ?? null;
}

async function ensureMemory(db: Db, conversationId: string, userId: string) {
  await db.insert(conversationMemories).values({ conversationId, userId }).onConflictDoNothing();
  return (await getMemory(db, conversationId))!;
}

/**
 * Write a new summary only if nobody else updated memory since `version` was read.
 * Returns false when another writer won (nothing is written).
 */
export async function writeSummary(
  db: Db,
  conversationId: string,
  version: number,
  next: { summary: string; facts: PhysicsFacts; summarizedThroughSeq: number },
) {
  const rows = await db
    .update(conversationMemories)
    .set({ ...next, version: version + 1 })
    .where(and(eq(conversationMemories.conversationId, conversationId), eq(conversationMemories.version, version)))
    .returning({ v: conversationMemories.version });
  return rows.length > 0;
}

/** Regenerating an already-summarised answer makes the summary stale: wipe it (rebuilt next time). */
export async function invalidateSummaryFrom(db: Db, conversationId: string, seq: number) {
  const mem = await getMemory(db, conversationId);
  if (!mem || seq > mem.summarizedThroughSeq) return false;
  return writeSummary(db, conversationId, mem.version, { summary: "", facts: {}, summarizedThroughSeq: 0 });
}

/** Mock mode (no key): a plain digest of the learner's questions keeps the pipeline testable offline. */
function mockSummary(previous: string, newText: string[]) {
  const asked = newText.filter(Boolean).map((t) => `- ${t.slice(0, 100)}`);
  return { summary: [previous, ...asked].filter(Boolean).join("\n").slice(-1_500), facts: {} as PhysicsFacts };
}

/** Summarise if due. Safe to call after every turn. Returns what happened (for tests and logs). */
export async function maybeSummarize(
  llm: Llm,
  db: Db,
  ids: { conversationId: string; userId: string },
): Promise<"not_due" | "updated" | "conflict" | "invalid"> {
  const [{ lastSeq } = { lastSeq: 0 }] = await db
    .select({ lastSeq: max(messages.seq) })
    .from(messages)
    .where(eq(messages.conversationId, ids.conversationId));
  const mem = await ensureMemory(db, ids.conversationId, ids.userId);
  const last = lastSeq ?? 0;
  if (!shouldSummarize(last, mem.summarizedThroughSeq)) return "not_due";

  const fresh = await db
    .select({ seq: messages.seq, role: messages.role, content: messages.content, parts: messages.parts })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, ids.conversationId),
        gt(messages.seq, mem.summarizedThroughSeq),
        inArray(messages.status, ["complete", "cancelled"]),
      ),
    )
    .orderBy(messages.seq);
  const transcript = fresh
    .map((m) => `${m.role === "user" ? "Learner" : "Tutor"}: ${contextText({ ...m, role: m.role as "user" | "assistant" })}`)
    .join("\n\n");

  let next: z.infer<typeof SummaryOutputSchema>;
  if (llm.mode === "mock") {
    next = mockSummary(mem.summary, fresh.filter((m) => m.role === "user").map((m) => m.content));
  } else {
    try {
      const prompt = `${SUMMARY_INSTRUCTIONS}\n\nPrevious summary:\n${mem.summary || "(none)"}\n\nPrevious facts:\n${factsText(mem.facts) || "(none)"}\n\nNew messages:\n${transcript}`;
      const res = await generateWithFallback(
        llm.deps,
        { role: "summary", estTokens: estimateTokens(prompt) + 600, purpose: "summary" },
        (model, spec) =>
          generateText({
            model,
            prompt,
            output: Output.object({ schema: SummaryOutputSchema }),
            temperature: 0.2,
            maxOutputTokens: 1_500,
            maxRetries: 0,
            // Facts are optional by design, which strict JSON-schema mode rejects: JSON mode + Zod instead.
            providerOptions: { groq: { structuredOutputs: false } },
            ...(spec.supportsReasoning ? { reasoning: "low" as const } : {}),
          }),
      );
      next = res.value.output;
    } catch (err) {
      // Never log content: only that the summariser output was unusable.
      logger.error("memory.summary_invalid", { conversationId: ids.conversationId, reason: (err as Error)?.name ?? "unknown" });
      return "invalid";
    }
  }

  const ok = await writeSummary(db, ids.conversationId, mem.version, {
    summary: next.summary,
    facts: next.facts,
    summarizedThroughSeq: last,
  });
  return ok ? "updated" : "conflict";
}
