"use client";

import { BookOpenText, Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { Popover } from "radix-ui";
import { useEffect, useState } from "react";

import { cn } from "@/lib/cn";
import { DOCUMENTS_CHANGED, fetchLibrary } from "@/lib/documents-client";
import type { DocumentSummary } from "@/shared/documents";

export const MAX_SELECTED = 5;

/** Pick which of your ready textbooks the tutor may search in this chat (max 5, P3-S5-M05). */
export function DocumentSelector({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const [docs, setDocs] = useState<DocumentSummary[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const load = () =>
      fetchLibrary()
        .then((s) => live && setDocs(s.documents))
        .catch(() => live && setDocs([]));
    void load();
    window.addEventListener(DOCUMENTS_CHANGED, load);
    return () => {
      live = false;
      window.removeEventListener(DOCUMENTS_CHANGED, load);
    };
  }, []);

  const ready = (docs ?? []).filter((d) => d.status === "ready");
  const processing = (docs ?? []).filter((d) => d.status === "queued" || d.status === "processing");
  // Selections pointing at deleted documents disappear.
  const selected = value.filter((id) => ready.some((d) => d.id === id));

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      setNotice(null);
      onChange(selected.filter((x) => x !== id));
    } else if (selected.length >= MAX_SELECTED) setNotice(`You can use up to ${MAX_SELECTED} textbooks in one chat.`);
    else {
      setNotice(null);
      onChange([...selected, id]);
    }
  };

  const label = selected.length === 0 ? "No textbook" : selected.length === 1 ? (ready.find((d) => d.id === selected[0])?.title ?? "1 textbook") : `${selected.length} textbooks`;

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          data-testid="document-selector"
          aria-label={`Textbooks for this chat: ${label}`}
          className={cn(
            "border-border text-muted hover:text-text inline-flex min-h-9 max-w-[16rem] items-center gap-1.5 rounded-full border px-3 text-[13px]",
            selected.length > 0 && "border-[color-mix(in_oklch,var(--field)_45%,transparent)] text-text",
          )}
        >
          <BookOpenText className="text-field size-4 shrink-0" aria-hidden />
          <span className="truncate">{label}</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="start"
          sideOffset={8}
          className="border-border bg-surface z-50 w-[min(92vw,340px)] rounded-[var(--radius-md)] border p-2 shadow-xl"
        >
          <p className="text-muted px-2 pt-1 pb-2 text-[12px]">Answers can cite pages from the textbooks you pick.</p>
          {docs === null ? (
            <p className="text-muted flex items-center gap-2 px-2 py-3 text-sm">
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> Loading
            </p>
          ) : ready.length === 0 ? (
            <p className="px-2 py-3 text-sm">
              {processing.length ? "Your PDFs are still being processed." : "No textbooks yet."}{" "}
              <Link href="/library" className="text-field underline underline-offset-2">
                Open Library
              </Link>
            </p>
          ) : (
            <ul role="listbox" aria-multiselectable="true" aria-label="Textbooks" className="flex max-h-64 flex-col overflow-y-auto">
              {ready.map((d) => {
                const on = selected.includes(d.id);
                return (
                  <li key={d.id} role="option" aria-selected={on}>
                    <button
                      type="button"
                      onClick={() => toggle(d.id)}
                      className="hover:bg-surface-2 flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-left text-sm"
                    >
                      <span
                        className={cn(
                          "border-border grid size-4 shrink-0 place-items-center rounded border",
                          on && "border-field bg-field text-on-field",
                        )}
                      >
                        {on && <Check className="size-3" aria-hidden />}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{d.title}</span>
                      {d.pageCount && <span className="text-muted text-[12px]">{d.pageCount} pp.</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {notice && (
            <p role="alert" className="text-danger px-2 pt-2 text-[12px]">
              {notice}
            </p>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
