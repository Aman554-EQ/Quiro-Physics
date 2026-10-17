"use client";

import { Command as CommandIcon, Lock, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { AccountButton } from "@/components/auth/AccountButton";
import { BrandMark } from "@/components/physics/illustrations";
import { Wordmark } from "@/components/ui/brand";
import { Kbd } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

import { isActive, NAV_ITEMS } from "./nav-items";
import { useShell } from "./shell-context";
import { RecentChats } from "./RecentChats";
import { ThemeToggle } from "./ThemeToggle";

/** Full navigation panel, used by the desktop Sidebar and the mobile/tablet menu drawer. */
export function SidebarContent({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { newChat, setPaletteOpen, viewer } = useShell();

  return (
    <div className="flex h-full flex-col gap-4 p-3">
      <Link
        href="/"
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-2.5 rounded-[var(--radius-sm)] px-2 py-1.5",
          collapsed && "justify-center px-0",
        )}
        aria-label="Quiro Physics home"
      >
        {collapsed ? <BrandMark /> : <Wordmark />}
      </Link>

      <Button
        variant="primary"
        onClick={newChat}
        aria-label="New chat"
        className={cn("w-full", collapsed && "size-11 w-11 self-center p-0")}
      >
        <Plus className="size-5" aria-hidden />
        {!collapsed && <span>New chat</span>}
      </Button>

      <nav aria-label="Main" className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              title={collapsed ? item.label : undefined}
              className={cn(
                "group text-muted hover:bg-surface-2 hover:text-text relative flex min-h-11 items-center gap-3 rounded-[var(--radius-sm)] px-3 text-[15px] transition-colors",
                active && "bg-surface-2 text-text",
                collapsed && "justify-center px-0",
              )}
            >
              {active && (
                <span
                  aria-hidden
                  className="bg-field absolute inset-y-2 left-0 w-[3px] rounded-full shadow-[0_0_12px_var(--field)]"
                />
              )}
              <Icon className={cn("size-5 shrink-0", active && "text-field")} aria-hidden />
              {collapsed ? (
                <span className="sr-only">{item.label}</span>
              ) : (
                <span className="flex-1">{item.label}</span>
              )}
              {!collapsed && item.requiresAuth && !viewer.signedIn && (
                <Lock className="size-3.5 opacity-50" aria-label="Needs an account" />
              )}
            </Link>
          );
        })}
      </nav>

      {!collapsed && (
        <section aria-labelledby="recent-heading" className="mt-2 flex min-h-0 flex-1 flex-col gap-2 px-1">
          <h2 id="recent-heading" className="text-muted px-2 text-xs font-medium tracking-[0.12em] uppercase">
            Recent chats
          </h2>
          {viewer.signedIn ? (
            <RecentChats onNavigate={onNavigate} />
          ) : (
            <p className="border-border text-muted rounded-[var(--radius-sm)] border border-dashed px-3 py-3 text-sm">
              Sign in to keep your chat history. Guests can ask 6 follow-ups per question.
            </p>
          )}
        </section>
      )}
      {collapsed && <div className="flex-1" />}

      <AccountButton collapsed={collapsed} />
      <div className={cn("border-border flex items-center gap-1 border-t pt-3", collapsed && "flex-col")}>
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "md"}
          onClick={() => setPaletteOpen(true)}
          // WCAG 2.5.3: the accessible name must include the visible label ("Commands")
          aria-label={collapsed ? "Commands" : undefined}
          aria-keyshortcuts="Control+K Meta+K"
          data-testid="palette-trigger"
          className={cn(!collapsed && "flex-1 justify-start")}
        >
          <CommandIcon className="size-5" aria-hidden />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Commands</span>
              <Kbd>Ctrl K</Kbd>
            </>
          )}
        </Button>
        <ThemeToggle />
      </div>
    </div>
  );
}
