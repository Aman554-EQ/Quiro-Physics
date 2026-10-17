"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";

import { isActive, NAV_ITEMS } from "./nav-items";

/** Phone (< 640 px) bottom navigation: 5 destinations, 56 px + safe-area inset. */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      data-testid="bottom-nav"
      className="border-border bg-surface/85 shrink-0 border-t backdrop-blur-xl sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      data-print-hide
    >
      <ul className="grid h-14 grid-cols-5">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "text-muted relative flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
                  active && "text-field",
                )}
              >
                {active && (
                  <span
                    aria-hidden
                    className="bg-field absolute top-0 h-[2px] w-8 rounded-full shadow-[0_0_10px_var(--field)]"
                  />
                )}
                <Icon className="size-[22px]" aria-hidden />
                <span>{item.shortLabel}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
