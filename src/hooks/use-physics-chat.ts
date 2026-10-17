"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { applyEvent } from "@/lib/chat/apply-event";
import type { ChatTransport, ThreadRef } from "@/lib/chat/transport";
import type { ChatMessage, Limit } from "@/shared/ui-message";

export type ChatStatus = "ready" | "submitted" | "streaming" | "error";

/** UI renders at most every ~50 ms while streaming (STREAMING.md §6). */
export const RENDER_THROTTLE_MS = 50;

let idCounter = 0;
const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${(idCounter++).toString(36)}`;

export interface PhysicsChatOptions {
  /** Saved messages of an existing conversation (signed-in users). */
  initialMessages?: ChatMessage[];
  /** The conversation / guest thread these messages belong to. */
  initialThread?: ThreadRef | null;
  /** Called when the server assigns a thread (e.g. a new saved conversation). */
  onThread?: (thread: ThreadRef & { title?: string }, isNew: boolean) => void;
}

export function usePhysicsChat(transport: ChatTransport, options: PhysicsChatOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => options.initialMessages ?? []);
  const [status, setStatus] = useState<ChatStatus>("ready");
  const [thread, setThread] = useState<ThreadRef | null>(options.initialThread ?? null);
  const threadRef = useRef<ThreadRef | null>(options.initialThread ?? null);
  const onThreadRef = useRef(options.onThread);
  useEffect(() => {
    onThreadRef.current = options.onThread;
  });
  /** Id of the most recently completed assistant message (drives the aria-live announcement). */
  const [completedId, setCompletedId] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const pendingRef = useRef<ChatMessage | null>(null);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    flushTimer.current = null;
    const pending = pendingRef.current;
    if (!pending) return;
    setMessages((prev) => prev.map((m) => (m.id === pending.id ? pending : m)));
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushTimer.current === null) flushTimer.current = setTimeout(flush, RENDER_THROTTLE_MS);
  }, [flush]);

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
        const finalStatus = controller.signal.aborted
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
        if (flushTimer.current) clearTimeout(flushTimer.current);
        flush();
        pendingRef.current = null;
        abortRef.current = null;
      }
    },
    [transport, scheduleFlush, flush],
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

  useEffect(() => () => abortRef.current?.abort(), []);

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
