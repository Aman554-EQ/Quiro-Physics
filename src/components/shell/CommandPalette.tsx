"use client";

import { Command } from "cmdk";
import { Gauge, MoonStar, Plus, Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { useEffect, useRef } from "react";

import { Kbd } from "@/components/ui/primitives";
import { toggleMotion } from "@/hooks/use-reduced-motion";
import { useTheme } from "@/hooks/use-theme";

import { NAV_ITEMS } from "./nav-items";
import { useShell } from "./shell-context";

const itemClass =
  "flex min-h-11 cursor-pointer items-center gap-3 rounded-[var(--radius-sm)] px-3 text-[15px] text-text aria-selected:bg-surface-2 aria-selected:text-field";

/**
 * ⌘K / Ctrl+K command palette. Global shortcuts handled here as well:
 * Ctrl+Shift+O → new chat.
 */
export function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const { paletteOpen, setPaletteOpen, paletteReturnFocus, newChat } = useShell();
  const navigated = useRef(false);
  const [, , toggleTheme] = useTheme();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(!paletteOpen);
      } else if (mod && e.shiftKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        newChat();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paletteOpen, setPaletteOpen, newChat]);

  const run = (fn: () => void) => {
    navigated.current = true;
    setPaletteOpen(false);
    fn();
  };

  return (
    <Dialog.Root open={paletteOpen} onOpenChange={setPaletteOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm" />
        <Dialog.Content
          onCloseAutoFocus={(e) => {
            // Return focus to whatever opened the palette (button or keyboard shortcut).
            e.preventDefault();
            if (!navigated.current) paletteReturnFocus.current?.focus();
            navigated.current = false;
          }}
          data-testid="command-palette"
          className="border-border bg-surface shadow-glow fixed top-[12dvh] left-1/2 z-50 w-[min(92vw,560px)] -translate-x-1/2 overflow-hidden rounded-[var(--radius-md)] border outline-none"
        >
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <Dialog.Description className="sr-only">
            Search pages and actions, then press Enter
          </Dialog.Description>
          <Command label="Command palette" loop>
            <div className="border-border flex items-center gap-2 border-b px-4">
              <Search className="text-muted size-4" aria-hidden />
              <Command.Input
                autoFocus
                placeholder="Go to… or run a command"
                className="text-text placeholder:text-muted h-13 flex-1 bg-transparent outline-none"
              />
              <Kbd>Esc</Kbd>
            </div>
            <Command.List className="max-h-[60dvh] overflow-y-auto p-2">
              <Command.Empty className="text-muted px-3 py-6 text-center text-sm">No matches.</Command.Empty>
              <Command.Group
                heading="Go to"
                className="text-muted text-xs [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5"
              >
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Command.Item
                      key={item.href}
                      value={`${item.label} ${item.shortLabel} ${item.keywords.join(" ")}`}
                      onSelect={() => run(() => router.push(item.href))}
                      className={itemClass}
                    >
                      <Icon className="text-muted size-4" aria-hidden />
                      <span className="flex-1">{item.label}</span>
                      {pathname === item.href && <span className="text-muted text-xs">current</span>}
                    </Command.Item>
                  );
                })}
              </Command.Group>
              <Command.Group
                heading="Actions"
                className="text-muted text-xs [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5"
              >
                <Command.Item value="new chat question" onSelect={() => run(newChat)} className={itemClass}>
                  <Plus className="text-muted size-4" aria-hidden />
                  <span className="flex-1">New chat</span>
                  <Kbd>Ctrl ⇧ O</Kbd>
                </Command.Item>
                <Command.Item
                  value="toggle theme dark light"
                  onSelect={() => run(toggleTheme)}
                  className={itemClass}
                >
                  <MoonStar className="text-muted size-4" aria-hidden />
                  <span className="flex-1">Toggle theme</span>
                </Command.Item>
                <Command.Item
                  value="toggle motion animation reduce"
                  onSelect={() => run(toggleMotion)}
                  className={itemClass}
                >
                  <Gauge className="text-muted size-4" aria-hidden />
                  <span className="flex-1">Toggle motion</span>
                </Command.Item>
              </Command.Group>
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
