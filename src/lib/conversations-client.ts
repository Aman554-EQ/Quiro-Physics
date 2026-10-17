"use client";

import { useCallback, useEffect, useState } from "react";

/** Client view of a saved conversation (GET /api/conversations). */
export interface ConversationItem {
  id: string;
  title: string;
  pinned: boolean;
  messageCount: number;
  lastMessageAt: string;
}

const CHANGED = "prc:conversations-changed";

/** Tell every list (sidebar, History) to reload: after a new chat, rename, pin or delete. */
export function notifyConversationsChanged() {
  window.dispatchEvent(new Event(CHANGED));
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? `Request failed (${res.status})`);
  }
  return (res.status === 204 ? null : await res.json()) as T;
}

export const conversationsApi = {
  list: (opts: { q?: string; cursor?: string | null } = {}) => {
    const params = new URLSearchParams();
    if (opts.q) params.set("q", opts.q);
    if (opts.cursor) params.set("cursor", opts.cursor);
    return api<{ items: ConversationItem[]; nextCursor: string | null }>(`/api/conversations?${params}`);
  },
  rename: (id: string, title: string) =>
    api<ConversationItem>(`/api/conversations/${id}`, { method: "PATCH", body: JSON.stringify({ title }) }),
  pin: (id: string, pinned: boolean) =>
    api<ConversationItem>(`/api/conversations/${id}`, { method: "PATCH", body: JSON.stringify({ pinned }) }),
  remove: (id: string) => api<null>(`/api/conversations/${id}`, { method: "DELETE" }),
  removeAll: () =>
    api<{ deleted: number }>("/api/conversations", { method: "DELETE", body: JSON.stringify({ confirm: "DELETE" }) }),
};

/** Load (and keep fresh) the first page of conversations, optionally filtered by title. */
export function useConversations(q = "") {
  const [items, setItems] = useState<ConversationItem[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const page = await conversationsApi.list({ q });
      setItems(page.items);
      setNextCursor(page.nextCursor);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [q]);

  const loadMore = useCallback(async () => {
    if (!nextCursor) return;
    const page = await conversationsApi.list({ q, cursor: nextCursor });
    setItems((prev) => [...(prev ?? []), ...page.items]);
    setNextCursor(page.nextCursor);
  }, [q, nextCursor]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    window.addEventListener(CHANGED, load);
    return () => window.removeEventListener(CHANGED, load);
  }, [load]);

  return { items, error, reload: load, loadMore, hasMore: Boolean(nextCursor), setItems };
}
