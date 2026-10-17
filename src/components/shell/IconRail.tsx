"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { BrandMark } from "@/components/physics/illustrations";
import { cn } from "@/lib/cn";

import { isActive, NAV_ITEMS } from "./nav-items";
import { useShell } from "./shell-context";
import { ThemeToggle } from "./ThemeToggle";

/** Tablet (640–1023 px) icon rail. The full sidebar opens as an overlay drawer from the menu button. */
export function IconRail() {
  const pathname = usePathname();
  const { setMenuOpen } = useShell();
  return (
    <aside
      data-testid="icon-rail"
      aria-label="Navigation rail"
      className="border-border bg-surface/60 hidden w-[72px] shrink-0 flex-col items-center gap-2 border-r py-3 backdrop-blur-xl sm:flex lg:hidden"
      data-print-hide
    >
      <Link href="/" aria-label="Quiro Physics home" className="grid size-11 place-items-center">
        <BrandMark />
      </Link>
      <button
        type="button"
        onClick={() => setMenuOpen(true)}
        aria-label="Open menu"
        data-testid="menu-button"
        className="text-muted hover:bg-surface-2 hover:text-text grid size-11 place-items-center rounded-[var(--radius-sm)]"
      >
        <Menu className="size-5" aria-hidden />
      </button>
      <nav aria-label="Main" className="mt-2 flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "text-muted hover:bg-surface-2 hover:text-text grid size-11 place-items-center rounded-[var(--radius-sm)]",
                active && "bg-surface-2 text-field",
              )}
            >
              <Icon className="size-5" aria-hidden />
              <span className="sr-only">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto">
        <ThemeToggle />
      </div>
    </aside>
  );
}
