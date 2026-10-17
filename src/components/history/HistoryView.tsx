"use client";

import { Check, Pencil, Pin, PinOff, Search, Trash2, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { AlertDialog } from "radix-ui";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Pendulum } from "@/components/physics/illustrations";
import { buttonVariants } from "@/components/ui/button-variants";
import { Skeleton } from "@/components/ui/primitives";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/cn";
import {
  conversationsApi,
  notifyConversationsChanged,
  useConversations,
  type ConversationItem,
} from "@/lib/conversations-client";
import { groupConversations, shortWhen } from "@/lib/history-groups";

const UNDO_MS = 5_000;

/** /history: search, date groups, rename, pin, delete (confirm or swipe, with Undo). */
export function HistoryView() {
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQ(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const { items, error, hasMore, loadMore, setItems } = useConversations(q);
  const pending = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  /** Hide now, delete after the undo window (UI_UX.md §5). */
  const deleteWithUndo = (c: ConversationItem) => {
    setItems((prev) => prev?.filter((i) => i.id !== c.id) ?? prev);
    const timer = setTimeout(async () => {
      pending.current.delete(c.id);
      try {
        await conversationsApi.remove(c.id);
      } catch {
        toast.error("Couldn't delete that chat. Please try again.");
      }
      notifyConversationsChanged();
    }, UNDO_MS);
    pending.current.set(c.id, timer);
    toast("Chat deleted", {
      duration: UNDO_MS,
      action: {
        label: "Undo",
        onClick: () => {
          clearTimeout(pending.current.get(c.id));
          pending.current.delete(c.id);
          notifyConversationsChanged();
        },
      },
    });
  };

  // Leaving the page doesn't cancel a pending delete.
  useEffect(() => {
    const map = pending.current;
    return () => {
      for (const [id, t] of map) {
        clearTimeout(t);
        void conversationsApi.remove(id).then(notifyConversationsChanged);
      }
    };
  }, []);

  return (
    <div className="mt-6 space-y-6">
      <label className="border-border bg-surface/70 focus-within:border-field flex min-h-11 items-center gap-2 rounded-[var(--radius-md)] border px-3">
        <Search className="text-muted size-4" aria-hidden />
        <span className="sr-only">Search chats by title</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search chats"
          className="placeholder:text-muted min-w-0 flex-1 bg-transparent py-2 outline-none"
          data-testid="history-search"
        />
      </label>

      {error && <p className="text-danger">Couldn&apos;t load your chats. {error}</p>}

      {!items && !error && (
        <div aria-hidden className="space-y-2">
          <Skeleton className="h-14" />
          <Skeleton className="h-14 w-11/12" />
          <Skeleton className="h-14" />
        </div>
      )}

      {items && items.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-12 text-center" data-testid="history-empty">
          <Pendulum className="h-24 w-auto" />
          <p className="text-muted">{q ? `No chats match "${q}".` : "No saved chats yet. Ask your first question."}</p>
          {!q && (
            <Link href="/chat" className={buttonVariants({ variant: "primary" })}>
              Ask a question
            </Link>
          )}
        </div>
      )}

      {items &&
        groupConversations(items).map(({ group, items: rows }) => (
          <section key={group} aria-labelledby={`hg-${group}`} data-testid={`history-group-${group}`}>
            <h2 id={`hg-${group}`} className="text-muted mb-2 text-xs font-medium tracking-[0.12em] uppercase">
              {group}
            </h2>
            <ul className="space-y-1.5">
              {rows.map((c) => (
                <HistoryRow
                  key={c.id}
                  item={c}
                  onDelete={() => deleteWithUndo(c)}
                  onChanged={(next) => setItems((prev) => prev?.map((i) => (i.id === next.id ? next : i)) ?? prev)}
                />
              ))}
            </ul>
          </section>
        ))}

      {hasMore && (
        <button type="button" onClick={() => void loadMore()} className={buttonVariants({ variant: "secondary" })}>
          Show more
        </button>
      )}
    </div>
  );
}

function HistoryRow({
  item,
  onDelete,
  onChanged,
}: {
  item: ConversationItem;
  onDelete: () => void;
  onChanged: (next: ConversationItem) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const reduced = useReducedMotion();
  const iconBtn =
    "text-muted hover:text-text hover:bg-surface-2 grid size-11 shrink-0 place-items-center rounded-[var(--radius-sm)]";

  const saveTitle = async () => {
    const next = title.trim();
    if (!next || next.length > 120 || next === item.title) {
      setEditing(false);
      setTitle(item.title);
      return;
    }
    try {
      onChanged(await conversationsApi.rename(item.id, next));
      notifyConversationsChanged();
    } catch {
      toast.error("Couldn't rename that chat.");
      setTitle(item.title);
    }
    setEditing(false);
  };

  const togglePin = async () => {
    try {
      onChanged(await conversationsApi.pin(item.id, !item.pinned));
      notifyConversationsChanged();
    } catch {
      toast.error("Couldn't update that chat.");
    }
  };

  return (
    <li className="relative" data-testid="history-row">
      {!isDesktop && (
        <div aria-hidden className="bg-danger/15 text-danger absolute inset-0 flex items-center justify-end rounded-[var(--radius-md)] pr-5">
          <Trash2 className="size-5" />
        </div>
      )}
      <motion.div
        drag={!isDesktop && !editing && !reduced ? "x" : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0.6, right: 0 }}
        onDragEnd={(_e, info) => {
          if (info.offset.x < -110) onDelete();
        }}
        className="border-border bg-surface relative flex items-center gap-1 rounded-[var(--radius-md)] border py-1 pr-1 pl-4"
      >
        {editing ? (
          <form
            className="flex min-w-0 flex-1 items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              void saveTitle();
            }}
          >
            <label className="sr-only" htmlFor={`title-${item.id}`}>
              Chat title
            </label>
            <input
              id={`title-${item.id}`}
              autoFocus
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setEditing(false);
                  setTitle(item.title);
                }
              }}
              className="border-border bg-surface-2 min-w-0 flex-1 rounded-[var(--radius-sm)] border px-2 py-1.5"
              data-testid="rename-input"
            />
            <button type="submit" className={iconBtn} aria-label="Save title">
              <Check className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              className={iconBtn}
              aria-label="Cancel rename"
              onClick={() => {
                setEditing(false);
                setTitle(item.title);
              }}
            >
              <X className="size-4" aria-hidden />
            </button>
          </form>
        ) : (
          <>
            <Link href={`/chat/${item.id}`} className="flex min-h-11 min-w-0 flex-1 items-center gap-3 py-1.5">
              <span className="min-w-0 flex-1 truncate text-[15px]">{item.title}</span>
              <span className="text-muted shrink-0 text-xs tabular-nums">{shortWhen(item.lastMessageAt)}</span>
            </Link>
            <button type="button" className={iconBtn} aria-label={`Rename "${item.title}"`} onClick={() => setEditing(true)}>
              <Pencil className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              className={cn(iconBtn, item.pinned && "text-field")}
              aria-label={item.pinned ? `Unpin "${item.title}"` : `Pin "${item.title}"`}
              aria-pressed={item.pinned}
              onClick={() => void togglePin()}
            >
              {item.pinned ? <PinOff className="size-4" aria-hidden /> : <Pin className="size-4" aria-hidden />}
            </button>
            <AlertDialog.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
              <AlertDialog.Trigger asChild>
                <button type="button" className={iconBtn} aria-label={`Delete "${item.title}"`}>
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </AlertDialog.Trigger>
              <AlertDialog.Portal>
                <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
                <AlertDialog.Content className="border-border bg-surface fixed top-1/2 left-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-lg)] border p-6 shadow-xl">
                  <AlertDialog.Title className="font-display text-xl font-semibold">Delete this chat?</AlertDialog.Title>
                  <AlertDialog.Description className="text-muted mt-2 text-[15px]">
                    &ldquo;{item.title}&rdquo; and everything the tutor remembers about it will be removed. You can undo
                    for a few seconds.
                  </AlertDialog.Description>
                  <div className="mt-5 flex justify-end gap-2">
                    <AlertDialog.Cancel className={buttonVariants({ variant: "secondary" })}>Cancel</AlertDialog.Cancel>
                    <AlertDialog.Action
                      className={cn(buttonVariants({ variant: "primary" }), "bg-danger text-white")}
                      onClick={onDelete}
                      data-testid="confirm-delete"
                    >
                      Delete
                    </AlertDialog.Action>
                  </div>
                </AlertDialog.Content>
              </AlertDialog.Portal>
            </AlertDialog.Root>
          </>
        )}
      </motion.div>
    </li>
  );
}
