"use client";

import type { Viewer } from "@/shared/viewer";

import { BottomNav } from "./BottomNav";
import { CommandPalette } from "./CommandPalette";
import { IconRail } from "./IconRail";
import { MobileMenu } from "./MobileMenu";
import { ShellProvider, useShell } from "./shell-context";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

/**
 * Responsive app frame.
 * < 640 px: TopBar + content + BottomNav (+ menu drawer)
 * 640–1023 px: IconRail + content (+ menu drawer)
 * ≥ 1024 px: Sidebar (collapsible) + content
 */
export function AppShell({ children, viewer }: { children: React.ReactNode; viewer?: Viewer }) {
  return (
    <ShellProvider viewer={viewer}>
      <ShellFrame>{children}</ShellFrame>
      <MobileMenu />
      <CommandPalette />
    </ShellProvider>
  );
}

function ShellFrame({ children }: { children: React.ReactNode }) {
  const { menuOpen, paletteOpen, overlayOpen } = useShell();
  // While a modal surface is open, the page behind it is inert: no focus, no screen-reader access.
  // (Radix's aria-hidden skips containers with live regions, so `inert` is the reliable guard.)
  const blocked = menuOpen || paletteOpen || overlayOpen;
  return (
    <div data-testid="app-root" inert={blocked} className="flex h-dvh w-full overflow-hidden">
      <Sidebar />
      <IconRail />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main id="main" className="doodles flex min-h-0 flex-1 flex-col">
          {children}
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
