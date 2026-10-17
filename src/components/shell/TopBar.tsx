"use client";

import { Menu, SquarePen } from "lucide-react";
import { usePathname } from "next/navigation";

import { titleFor } from "./nav-items";
import { useShell } from "./shell-context";

/** Phone (< 640 px) top bar: menu · page title · new chat. */
export function TopBar() {
  const pathname = usePathname();
  const { setMenuOpen, newChat } = useShell();
  return (
    <header
      data-testid="top-bar"
      className="border-border bg-surface/70 flex h-14 shrink-0 items-center gap-1 border-b px-1.5 backdrop-blur-xl sm:hidden"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
      data-print-hide
    >
      <button
        type="button"
        onClick={() => setMenuOpen(true)}
        aria-label="Open menu"
        data-testid="menu-button"
        className="text-muted hover:text-text grid size-11 place-items-center rounded-[var(--radius-sm)]"
      >
        <Menu className="size-5" aria-hidden />
      </button>
      <p className="font-display flex-1 truncate text-center text-[17px] font-semibold">
        {titleFor(pathname)}
      </p>
      <button
        type="button"
        onClick={newChat}
        aria-label="New chat"
        className="text-muted hover:text-text grid size-11 place-items-center rounded-[var(--radius-sm)]"
      >
        <SquarePen className="size-5" aria-hidden />
      </button>
    </header>
  );
}
