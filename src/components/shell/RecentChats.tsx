"use client";

import { Pin } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Skeleton } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { useConversations } from "@/lib/conversations-client";

const SHOWN = 8;

/** The signed-in user's latest chats in the sidebar (full list on /history). */
export function RecentChats({ onNavigate }: { onNavigate?: () => void }) {
  const { items, error } = useConversations();
  const pathname = usePathname();

  if (error) return <p className="text-muted px-2 text-sm">Couldn&apos;t load your chats.</p>;
  if (!items)
    return (
      <div className="space-y-2 px-1" aria-hidden>
        <Skeleton className="h-8" />
        <Skeleton className="h-8 w-10/12" />
      </div>
    );
  if (items.length === 0)
    return <p className="text-muted px-2 text-sm">Your chats will appear here after your first question.</p>;

  return (
    <ul className="-mx-1 min-h-0 flex-1 space-y-0.5 overflow-y-auto" data-testid="recent-chats">
      {items.slice(0, SHOWN).map((c) => {
        const href = `/chat/${c.id}`;
        const active = pathname === href;
        return (
          <li key={c.id}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "text-muted hover:bg-surface-2 hover:text-text flex min-h-9 items-center gap-2 rounded-[var(--radius-sm)] px-3 text-sm",
                active && "bg-surface-2 text-text",
              )}
            >
              {c.pinned && <Pin className="size-3.5 shrink-0" aria-label="Pinned" />}
              <span className="truncate">{c.title}</span>
            </Link>
          </li>
        );
      })}
      {items.length > SHOWN && (
        <li>
          <Link href="/history" onClick={onNavigate} className="text-field block px-3 py-1.5 text-sm hover:underline">
            See all chats
          </Link>
        </li>
      )}
    </ul>
  );
}
