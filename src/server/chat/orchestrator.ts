import "server-only";

import { createUIMessageStream, createUIMessageStreamResponse, streamText } from "ai";
import { eq } from "drizzle-orm";

import { userPreferences } from "@/db/schema";
import { pickScript } from "@/lib/mock/scripts";
import { runAfter } from "@/server/after";
import { getOptionalUser } from "@/server/auth/require-user";
import { getDb, type Db } from "@/server/db";
import { AppError } from "@/server/http";
import { getKV, type KV } from "@/server/kv";
import { appendGuestTurn, LimitError, openGuestTurn, type GuestTurn } from "@/server/limits/guest-threads";
import { clientIp, guestHash, ipHash, resolveGuest } from "@/server/limits/guest-identity";
import { RATE_LIMITS, slidingWindow } from "@/server/limits/rate-limit";
import { dailyMessageUsage } from "@/server/limits/user-limits";
import { getLlm, type Llm } from "@/server/llm";
import { logger } from "@/server/log";
import { buildContext, assembleTutorMessages, recentAsText, type BuiltContext } from "@/server/memory/context";
import { loadHistory } from "@/server/memory/history";
import { getMemory, invalidateSummaryFrom, maybeSummarize } from "@/server/memory/summary";
import { CapacityError, ModelError } from "@/server/models/errors";
import type { ModelRole } from "@/server/models/registry";
import { streamWithFallback } from "@/server/models/router";
import { ChatRequestSchema, MAX_QUESTION_TOKENS, type ThreadInfo } from "@/shared/chat-api";
import { GREETING_REPLY, offTopicRedirect, UNSAFE_REFUSAL } from "@/shared/redirects";
import type { Limit, MessagePart, Source } from "@/shared/ui-message";

import { beginUserTurn, finishAssistant, recordUsage, type AssistantResult } from "./persistence";
import { buildTutorSystemPrompt, type ExplanationLevel } from "./prompts";
import { runRouterChain, type Route } from "./router-chain";
import { generateTitle } from "./title";
import { estimateTokens } from "./tokens";

/**
 * POST /api/chat (STREAMING.md §4):
 *   validate → identity → limits → (user) pre-insert messages → stream:
 *   observe → router chain → route → [off-topic/greeting/unsafe: canned reply, no tutor call]
 *   → derive → tutor stream (fallback only before the first token) → verify → limit + usage
 *   → persist exactly what streamed (complete / cancelled / error) → after(): title, summary.
 */

type Identity =
  | { kind: "user"; userId: string }
  | { kind: "guest"; guestId: string; ipHash: string; setCookie: string | null };

/** Difficulty 1–2 low, 3 medium, 4–5 high; guests are capped at medium (STREAMING.md §7). */
export function reasoningEffort(difficulty: number, isGuest: boolean): "low" | "medium" | "high" {
  const effort = difficulty <= 2 ? "low" : difficulty === 3 ? "medium" : "high";
  return isGuest && effort === "high" ? "medium" : effort;
}

export function tutorRole(route: Route, isGuest: boolean): ModelRole {
  if (isGuest) return "guest";
  return route.difficulty >= 3 || route.queryType === "numerical" || route.queryType === "derivation"
    ? "tutorComplex"
    : "tutorSimple";
}

const CANNED: Partial<Record<Route["scope"], (q: string) => string>> = {
  off_topic: offTopicRedirect,
  unsafe: () => UNSAFE_REFUSAL,
  greeting: () => GREETING_REPLY,
};

async function explanationLevel(db: Db, userId: string): Promise<ExplanationLevel> {
  const [pref] = await db
    .select({ level: userPreferences.explanationLevel })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId));
  return pref?.level ?? "intermediate";
}

async function resolveIdentity(req: Request): Promise<Identity> {
  const user = await getOptionalUser();
  if (user) return { kind: "user", userId: user.userId };
  const { guestId, setCookie } = resolveGuest(req);
  return { kind: "guest", guestId, ipHash: ipHash(clientIp(req)), setCookie };
}

async function enforceRateLimit(kv: KV, id: Identity) {
  const { limit, windowMs } = id.kind === "user" ? RATE_LIMITS.user : RATE_LIMITS.guest;
  const key = id.kind === "user" ? `user:${id.userId}` : `guest:${id.ipHash}`;
  const r = await slidingWindow(kv, key, limit, windowMs);
  if (!r.ok) throw new LimitError("RATE_LIMITED", "You're sending messages quickly. Please wait a moment.", r.resetAt);
}

export async function handleChat(req: Request): Promise<Response> {
  const body = ChatRequestSchema.parse(await req.json());
  const text = body.message.text;
  if (estimateTokens(text) > MAX_QUESTION_TOKENS)
    throw new AppError(
      413,
      "MESSAGE_TOO_LONG",
      "That question is too long for one message. Please shorten it or split it into parts.",
    );

  const kv = getKV();
  const llm = getLlm();
  const identity = await resolveIdentity(req);
  await enforceRateLimit(kv, identity);

  // ---------- Load the turn (limits are checked before any model call) ----------
  let thread: ThreadInfo;
  let context: BuiltContext;
  let limitPart: Limit;
  let level: ExplanationLevel = "intermediate";
  let assistantId: string | null = null;
  let userTurn: { conversationId: string; seq: number; isNew: boolean } | null = null;
  let db: Db | null = null;
  let guestThreadId: string | null = null;

  if (identity.kind === "user") {
    db = await getDb();
    const usage = await dailyMessageUsage(db, identity.userId);
    if (!body.regenerate && usage.used >= usage.limit)
      throw new LimitError(
        "DAILY_MESSAGE_LIMIT",
        `You've sent ${usage.limit} messages in the last 24 hours. You can send more soon.`,
        usage.resetAt ?? undefined,
      );
    const turn = await beginUserTurn(db, {
      userId: identity.userId,
      conversationId: body.conversationId,
      text,
      regenerate: body.regenerate,
    });
    if (turn.regenerated) await invalidateSummaryFrom(db, turn.conversationId, turn.assistantSeq);
    const [history, memory] = await Promise.all([
      loadHistory(db, identity.userId, turn.conversationId, { beforeSeq: turn.userMessage.seq }),
      getMemory(db, turn.conversationId),
    ]);
    context = buildContext(history, memory);
    level = await explanationLevel(db, identity.userId);
    assistantId = turn.assistantId;
    userTurn = { conversationId: turn.conversationId, seq: turn.userMessage.seq, isNew: turn.isNewConversation };
    thread = { kind: "conversation", id: turn.conversationId, title: turn.title };
    const used = usage.used + (turn.regenerated ? 0 : 1);
    limitPart = { kind: "user_daily", remaining: Math.max(0, usage.limit - used), limit: usage.limit };
  } else {
    const turn = await openGuestTurn(kv, {
      guestId: identity.guestId,
      ipHash: identity.ipHash,
      threadId: body.guestThreadId,
    });
    guestThreadId = turn.threadId;
    const prior = turn.thread.messages;
    const history = (body.regenerate ? prior.slice(0, -2) : prior).map((m, i) => ({
      seq: i + 1,
      role: m.role,
      content: m.text,
    }));
    context = buildContext(history, null);
    thread = { kind: "guest", id: turn.threadId };
    limitPart = { kind: "guest_turns", remaining: turn.remaining, limit: turn.limit };
  }

  // ---------- Stream ----------
  let resolveDone!: () => void;
  const done = new Promise<void>((r) => (resolveDone = r));
  // Persistence must finish even if the client disconnects: keep the function alive for it.
  runAfter(() => done);

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const write = (chunk: Parameters<typeof writer.write>[0]) => {
        try {
          writer.write(chunk);
        } catch {
          // client went away: keep going so the turn is persisted
        }
      };
      const started = Date.now();
      let answer = "";
      let reasoning = "";
      let reasoningMs: number | undefined;
      let sources: Source[] = [];
      let result: AssistantResult = { status: "error", content: "", parts: [] };
      let route: Route | null = null;

      try {
        write({ type: "start", messageId: assistantId ?? undefined });
        write({ type: "data-thread", data: thread, transient: true });
        write({ type: "data-status", data: { stage: "observe" }, transient: true });

        const router = await runRouterChain(llm, {
          message: text,
          recent: recentAsText(context.recent),
          summary: context.summary,
          documentTitles: [],
          signal: req.signal,
        });
        route = router.route;
        if (router.model)
          void logUsage(db, identity, null, {
            purpose: "router",
            model: router.model,
            promptTokens: router.promptTokens,
            completionTokens: router.completionTokens,
            latencyMs: router.latencyMs,
            retries: router.retries,
            fallbackUsed: router.fallbackUsed,
          });
        write({
          type: "data-route",
          data: { scope: route.scope, queryType: route.queryType, usingTextbook: llm.mode === "mock" && route.needsRetrieval },
          transient: true,
        });

        const canned = CANNED[route.scope];
        if (canned) {
          // Off-topic, unsafe and greetings never reach the tutor model (P2-S3-A04…A06).
          answer = canned(text);
          write({ type: "text-start", id: "t0" });
          for (const chunk of answer.match(/\S+\s*/g) ?? [answer]) write({ type: "text-delta", id: "t0", delta: chunk });
          write({ type: "text-end", id: "t0" });
          write({ type: "data-limit", data: limitPart });
          result = {
            status: "complete",
            content: answer,
            parts: [{ type: "text", text: answer }, { type: "data-limit", data: limitPart }],
            queryType: route.scope === "greeting" ? "greeting" : "off_topic",
            model: null,
            latencyMs: Date.now() - started,
          };
          return;
        }

        // Retrieval arrives in Phase 3. The offline demo tutor shows its labelled sample sources.
        if (llm.mode === "mock" && route.needsRetrieval) {
          sources = pickScript(text).sources ?? [];
          if (sources.length) {
            write({ type: "data-status", data: { stage: "measure" }, transient: true });
            write({ type: "data-sources", data: sources });
          }
        }

        write({ type: "data-status", data: { stage: "derive" }, transient: true });
        const isGuest = identity.kind === "guest";
        const system = buildTutorSystemPrompt({ queryType: route.queryType, explanationLevel: level });
        const { messages, estTokens } = assembleTutorMessages({
          system,
          context,
          question: route.standaloneQuestion,
        });
        const effort = reasoningEffort(route.difficulty, isGuest);
        const routed = await streamWithFallback(
          llm.deps,
          { role: tutorRole(route, isGuest), estTokens: estTokens + 1_500, purpose: "tutor", signal: req.signal },
          (model, spec) => {
            const r = streamText({
              model,
              instructions: system,
              messages,
              maxRetries: 0,
              abortSignal: req.signal,
              temperature: 0.3,
              maxOutputTokens: 3_000,
              ...(spec.supportsReasoning ? { reasoning: effort } : {}),
            });
            return { stream: r.stream, usage: r.usage };
          },
        );

        let reasoningStarted = 0;
        try {
          for await (const p of routed.parts) {
            switch (p.type) {
              case "reasoning-start":
                reasoningStarted = Date.now();
                write({ type: "reasoning-start", id: p.id });
                break;
              case "reasoning-delta":
                reasoning += p.text;
                write({ type: "reasoning-delta", id: p.id, delta: p.text });
                break;
              case "reasoning-end":
                reasoningMs = reasoningStarted ? Date.now() - reasoningStarted : undefined;
                write({ type: "reasoning-end", id: p.id });
                break;
              case "text-start":
                write({ type: "text-start", id: p.id });
                break;
              case "text-delta":
                answer += p.text;
                write({ type: "text-delta", id: p.id, delta: p.text });
                break;
              case "text-end":
                write({ type: "text-end", id: p.id });
                break;
              default:
                break;
            }
          }
        } catch (err) {
          const e = err as ModelError;
          answer = e.partialText || answer;
          throw err;
        }

        write({ type: "data-status", data: { stage: "verify" }, transient: true });
        if (sources.length) write({ type: "data-sources", data: sources });
        write({ type: "data-limit", data: limitPart });
        const usage = await routed.usage();
        write({
          type: "data-usage",
          data: {
            model: routed.model,
            fallbackUsed: routed.fallbackUsed,
            promptTokens: usage?.inputTokens ?? 0,
            completionTokens: usage?.outputTokens ?? 0,
          },
          transient: true,
        });
        result = {
          status: "complete",
          content: answer,
          parts: partsOf(reasoning, reasoningMs, answer, sources, limitPart, route),
          queryType: route.queryType,
          model: routed.model,
          fallbackUsed: routed.fallbackUsed,
          promptTokens: usage?.inputTokens ?? null,
          completionTokens: usage?.outputTokens ?? null,
          reasoningTokens: usage?.outputTokenDetails?.reasoningTokens ?? null,
          latencyMs: Date.now() - started,
          firstTokenMs: routed.firstTokenMs,
        };
        void logUsage(db, identity, assistantId, {
          purpose: "tutor",
          model: routed.model,
          promptTokens: usage?.inputTokens ?? null,
          completionTokens: usage?.outputTokens ?? null,
          latencyMs: Date.now() - started,
          retries: routed.retries,
          fallbackUsed: routed.fallbackUsed,
        });
      } catch (err) {
        const aborted = req.signal.aborted || (err instanceof ModelError && err.category === "aborted");
        if (err instanceof ModelError && err.partialText) answer = err.partialText;
        result = {
          status: aborted ? "cancelled" : "error",
          content: answer,
          parts: partsOf(reasoning, reasoningMs, answer, sources, null, route),
          queryType: route?.queryType,
          latencyMs: Date.now() - started,
        };
        if (!aborted) {
          logger.warn("chat.turn_error", {
            category: err instanceof ModelError ? err.category : ((err as Error)?.name ?? "unknown"),
            partialChars: answer.length,
          });
          write({ type: "error", errorText: friendlyError(err, answer.length > 0) });
        }
      } finally {
        try {
          await persist(llm, db, identity, assistantId, userTurn, guestThreadId, text, result, body.regenerate);
        } finally {
          resolveDone();
        }
      }
    },
    onError: (err) => friendlyError(err, false),
  });

  const headers: Record<string, string> = {};
  if (identity.kind === "guest" && identity.setCookie) headers["set-cookie"] = identity.setCookie;
  return createUIMessageStreamResponse({ stream, headers });
}

function partsOf(
  reasoning: string,
  reasoningMs: number | undefined,
  answer: string,
  sources: Source[],
  limit: Limit | null,
  route: Route | null = null,
): MessagePart[] {
  const parts: MessagePart[] = [];
  if (route)
    parts.push({ type: "data-route", data: { scope: route.scope, queryType: route.queryType, usingTextbook: sources.length > 0 } });
  if (reasoning) parts.push({ type: "reasoning", text: reasoning, durationMs: reasoningMs });
  if (answer) parts.push({ type: "text", text: answer });
  if (sources.length) parts.push({ type: "data-sources", data: sources });
  if (limit) parts.push({ type: "data-limit", data: limit });
  return parts;
}

function friendlyError(err: unknown, partial: boolean) {
  if (err instanceof CapacityError)
    return "The tutor is busy right now (free-tier capacity). Please try again in a minute.";
  if (partial) return "The connection to the model was interrupted. Retry to get the full answer.";
  return "Something went wrong while answering. Please try again.";
}

async function logUsage(
  db: Db | null,
  identity: Identity,
  messageId: string | null,
  row: {
    purpose: string;
    model: string;
    promptTokens: number | null;
    completionTokens: number | null;
    latencyMs: number;
    retries: number;
    fallbackUsed: boolean;
  },
) {
  try {
    const target = db ?? (await getDb());
    await recordUsage(target, {
      ...row,
      userId: identity.kind === "user" ? identity.userId : null,
      guestHash: identity.kind === "guest" ? guestHash(identity.guestId) : null,
      messageId,
    });
  } catch {
    // Metrics must never break a chat (and guests may run without a database).
  }
}

async function persist(
  llm: Llm,
  db: Db | null,
  identity: Identity,
  assistantId: string | null,
  userTurn: { conversationId: string; seq: number; isNew: boolean } | null,
  guestThreadId: string | null,
  question: string,
  result: AssistantResult,
  regenerate: boolean,
) {
  if (identity.kind === "user" && db && assistantId && userTurn) {
    await finishAssistant(db, assistantId, result);
    const ids = { userId: identity.userId, conversationId: userTurn.conversationId };
    if (userTurn.isNew && result.status === "complete") runAfter(() => generateTitle(llm, db, ids, question));
    if (result.status !== "error") runAfter(() => maybeSummarize(llm, db, ids));
    return;
  }
  if (guestThreadId) {
    const turns: GuestTurn[] = [
      { role: "user", text: question },
      { role: "assistant", text: result.content, status: result.status },
    ];
    const kv = getKV();
    if (regenerate) {
      const { getThread, threadKey } = await import("@/server/limits/guest-threads");
      const t = await getThread(kv, guestThreadId);
      if (t) {
        const ttl = await kv.ttl(threadKey(guestThreadId));
        await kv.set(threadKey(guestThreadId), { ...t, messages: t.messages.slice(0, -2) }, { ex: ttl > 0 ? ttl : 86_400 });
      }
    }
    await appendGuestTurn(kv, guestThreadId, turns);
  }
}
