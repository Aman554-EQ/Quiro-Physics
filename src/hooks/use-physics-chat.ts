"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { applyEvent } from "@/lib/chat/apply-event";
import { REVEAL_TICK_MS, revealStep, snapToWord, textLength, truncateText } from "@/lib/chat/reveal";
import type { ChatTransport, ThreadRef } from "@/lib/chat/transport";
import { messageText, type ChatMessage, type Limit } from "@/shared/ui-message";

export type ChatStatus = "ready" | "submitted" | "streaming" | "error";

let idCounter = 0;
const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${(idCounter++).toString(36)}`;

export interface PhysicsChatOptions {
  /** Saved messages of an existing conversation (signed-in users). */
  initialMessages?: ChatMessage[];
  /** The conversation / guest thread these messages belong to. */
  initialThread?: ThreadRef | null;
  /** Called when the server assigns a thread (e.g. a new saved conversation). */
  onThread?: (thread: ThreadRef & { title?: string }, isNew: boolean) => void;
  /** Textbooks to search for each turn (read when a message is sent). */
  documentIds?: string[];
}

export function usePhysicsChat(transport: ChatTransport, options: PhysicsChatOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => options.initialMessages ?? []);
  const [status, setStatus] = useState<ChatStatus>("ready");
  const [thread, setThread] = useState<ThreadRef | null>(options.initialThread ?? null);
  const threadRef = useRef<ThreadRef | null>(options.initialThread ?? null);
  const onThreadRef = useRef(options.onThread);
  const documentIdsRef = useRef(options.documentIds ?? []);
  useEffect(() => {
    onThreadRef.current = options.onThread;
    documentIdsRef.current = options.documentIds ?? [];
  });
  /** Id of the most recently completed assistant message (drives the aria-live announcement). */
  const [completedId, setCompletedId] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  /** Everything received so far for the answer being streamed. */
  const pendingRef = useRef<ChatMessage | null>(null);
  /** How many of its text characters are on screen (smooth reveal, lib/chat/reveal.ts). */
  const shownRef = useRef(0);
  const lastTickRef = useRef(0);
  const tickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drainedRef = useRef<(() => void) | null>(null);
  /** Lets the reveal loop reschedule itself from inside `tick`. */
  const tickRef = useRef<() => void>(() => {});
  const later = () => setTimeout(() => tickRef.current(), REVEAL_TICK_MS);

  /** Show the next slice of received text; reschedules itself until everything received is shown. */
  const tick = useCallback(() => {
    tickTimer.current = null;
    const full = pendingRef.current;
    if (!full) return;
    const now = Date.now();
    const total = textLength(full);
    const dt = Math.min(now - lastTickRef.current, 200);
    lastTickRef.current = now;
    if (shownRef.current < total)
      shownRef.current = snapToWord(messageText(full), shownRef.current + revealStep(total - shownRef.current, dt));
    const caughtUp = shownRef.current >= total;
    // Until the text has caught up the answer is still "streaming" (cursor on, actions hidden).
    const shown = caughtUp ? full : { ...truncateText(full, shownRef.current), status: "streaming" as const };
    setMessages((prev) => prev.map((m) => (m.id === full.id ? shown : m)));
    if (!caughtUp) tickTimer.current = later();
    else drainedRef.current?.();
  }, []);
  useEffect(() => {
    tickRef.current = tick;
  }, [tick]);

  const scheduleFlush = useCallback(() => {
    if (tickTimer.current === null) {
      lastTickRef.current = Date.now() - REVEAL_TICK_MS;
      tickTimer.current = later();
    }
  }, []);

  /** Show everything received right away (stop, errors, unmount). */
  const revealAll = useCallback(() => {
    shownRef.current = Number.MAX_SAFE_INTEGER;
    if (tickTimer.current) clearTimeout(tickTimer.current);
    tick();
  }, [tick]);

  /** Resolves once the received text is fully on screen. */
  const drain = useCallback(
    (signal: AbortSignal) =>
      new Promise<void>((resolve) => {
        if (!pendingRef.current || shownRef.current >= textLength(pendingRef.current)) return resolve();
        drainedRef.current = resolve;
        signal.addEventListener("abort", revealAll, { once: true });
        scheduleFlush();
      }).finally(() => {
        drainedRef.current = null;
      }),
    [revealAll, scheduleFlush],
  );

  const run = useCallback(
    async (userMessage: ChatMessage, history: ChatMessage[], regenerate = false) => {
      const assistant: ChatMessage = {
        id: newId("msg"),
        role: "assistant",
        parts: [],
        status: "streaming",
        meta: { startedAt: Date.now() },
      };
      pendingRef.current = assistant;
      shownRef.current = 0;
      setMessages([...history, userMessage, assistant]);
      setStatus("submitted");
      setCompletedId(null);

      const controller = new AbortController();
      abortRef.current = controller;
      let first = true;
      try {
        for await (const ev of transport.send({
          thread: threadRef.current,
          message: userMessage,
          signal: controller.signal,
          regenerate,
          documentIds: documentIdsRef.current,
        })) {
          if (controller.signal.aborted) break;
          if (ev.type === "data-thread") {
            const next = { kind: ev.data.kind, id: ev.data.id };
            const isNew = threadRef.current?.id !== next.id;
            threadRef.current = next;
            setThread(next);
            onThreadRef.current?.({ ...next, title: ev.data.title }, isNew);
            continue;
          }
          pendingRef.current = applyEvent(pendingRef.current!, ev);
          if (first && (ev.type === "text-delta" || ev.type === "reasoning-delta")) {
            first = false;
            setStatus("streaming");
          }
          scheduleFlush();
        }
        // The server is done; let the reveal catch up (Stop during this shows the rest at once:
        // the full answer is already saved, so the screen must match it).
        const endedNormally = !controller.signal.aborted;
        if (endedNormally && pendingRef.current!.status !== "error") await drain(controller.signal);
        const finalStatus = !endedNormally
          ? "cancelled"
          : pendingRef.current!.status === "error"
            ? "error"
            : "complete";
        pendingRef.current = { ...pendingRef.current!, status: finalStatus };
        if (finalStatus === "complete") setCompletedId(assistant.id);
        setStatus(finalStatus === "error" ? "error" : "ready");
      } catch (err) {
        const aborted = controller.signal.aborted || (err instanceof Error && err.name === "AbortError");
        pendingRef.current = { ...pendingRef.current!, status: aborted ? "cancelled" : "error" };
        setStatus(aborted ? "ready" : "error");
      } finally {
        revealAll();
        pendingRef.current = null;
        abortRef.current = null;
      }
    },
    [transport, scheduleFlush, drain, revealAll],
  );

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || abortRef.current) return false;
      const user: ChatMessage = {
        id: newId("msg"),
        role: "user",
        parts: [{ type: "text", text: trimmed }],
        status: "complete",
      };
      void run(user, messages);
      return true;
    },
    [messages, run],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  /** Replace the last assistant answer with a fresh one for the same question. */
  const regenerate = useCallback(() => {
    if (abortRef.current) return;
    const lastUserIdx = messages.findLastIndex((m) => m.role === "user");
    if (lastUserIdx < 0) return;
    void run(messages[lastUserIdx]!, messages.slice(0, lastUserIdx), true);
  }, [messages, run]);

  /** After "Stop": ask the tutor to carry on from the partial answer. */
  const continueAnswer = useCallback(() => send("Continue from where you stopped."), [send]);

  /** Start a new question thread (guest turn counter starts again). */
  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setStatus("ready");
    setCompletedId(null);
    threadRef.current = null;
    setThread(null);
  }, []);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      if (tickTimer.current) clearTimeout(tickTimer.current);
    },
    [],
  );

  const limit = useMemo<Limit | null>(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const part = messages[i]!.parts.find((p) => p.type === "data-limit") as { data: Limit } | undefined;
      if (part) return part.data;
    }
    return null;
  }, [messages]);

  const busy = status === "submitted" || status === "streaming";
  return { messages, status, busy, send, stop, regenerate, continueAnswer, reset, limit, completedId, thread };
}
