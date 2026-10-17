"use client";

import { UserButton } from "@clerk/nextjs";
import { LogIn, LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useShell } from "@/components/shell/shell-context";
import { cn } from "@/lib/cn";

/** Sidebar account control: "Sign in" for guests, Clerk's user menu (or the e2e sign-out) for users. */
export function AccountButton({ collapsed = false }: { collapsed?: boolean }) {
  const { viewer } = useShell();
  const router = useRouter();
  const base =
    "inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-sm)] px-3 text-[15px] text-muted hover:bg-surface-2 hover:text-text";

  if (!viewer.signedIn) {
    if (viewer.accounts === "none") return null;
    return (
      <Link
        href="/sign-in"
        className={cn(base, collapsed && "size-11 justify-center px-0")}
        aria-label={collapsed ? "Sign in" : undefined}
        data-testid="sign-in-link"
      >
        <LogIn className="size-5" aria-hidden />
        {!collapsed && "Sign in"}
      </Link>
    );
  }

  if (viewer.accounts === "clerk")
    return (
      <div className={cn("grid min-h-11 place-items-center", !collapsed && "px-2")} data-testid="user-button">
        <UserButton />
      </div>
    );

  // E2E test session
  return (
    <button
      type="button"
      className={cn(base, collapsed && "size-11 justify-center px-0")}
      aria-label={collapsed ? "Sign out" : undefined}
      data-testid="sign-out"
      onClick={async () => {
        await fetch("/api/test/session", { method: "DELETE" });
        router.push("/");
        router.refresh();
      }}
    >
      <LogOut className="size-5" aria-hidden />
      {!collapsed && "Sign out"}
    </button>
  );
}
