"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/** Distance (px) from the bottom that still counts as "at the bottom". */
export const STICK_THRESHOLD = 80;

/**
 * Keeps a scroll container pinned to the newest content while the user is at the bottom.
 * If the user scrolls up, it stops following and exposes `showJump` for a "Jump to latest" pill.
 */
export function useStickToBottom<T extends HTMLElement>(contentKey: unknown) {
  const ref = useRef<T>(null);
  const atBottomRef = useRef(true);
  const [showJump, setShowJump] = useState(false);

  const isAtBottom = (el: HTMLElement) => el.scrollHeight - el.scrollTop - el.clientHeight <= STICK_THRESHOLD;

  const onScroll = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const at = isAtBottom(el);
    atBottomRef.current = at;
    setShowJump(!at);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [onScroll]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el && atBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [contentKey]);

  const jumpToLatest = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    atBottomRef.current = true;
    setShowJump(false);
  }, []);

  return { ref, showJump, jumpToLatest };
}
