"use client";

import { Drawer } from "vaul";

import { SidebarContent } from "./SidebarContent";
import { useShell } from "./shell-context";

/**
 * Move focus into a drawer when it opens, so the focus trap engages and Tab stays inside.
 * (Vaul keeps focus on the trigger by default, which lets Tab escape to the page behind.)
 */
export function focusFirstIn(e: Event) {
  e.preventDefault();
  const root = e.currentTarget as HTMLElement | null;
  root
    ?.querySelector<HTMLElement>("a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])")
    ?.focus();
}

/** Phone/tablet navigation drawer (slides from the left, follows the finger, focus-trapped). */
export function MobileMenu() {
  const { menuOpen, setMenuOpen } = useShell();
  return (
    <Drawer.Root open={menuOpen} onOpenChange={setMenuOpen} direction="left">
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
        <Drawer.Content
          onOpenAutoFocus={focusFirstIn}
          data-testid="menu-drawer"
          className="border-border bg-surface fixed inset-y-0 left-0 z-50 flex w-[min(86vw,320px)] flex-col border-r outline-none"
          style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <Drawer.Title className="sr-only">Navigation menu</Drawer.Title>
          <Drawer.Description className="sr-only">Go to any section of the app</Drawer.Description>
          <SidebarContent onNavigate={() => setMenuOpen(false)} />
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
