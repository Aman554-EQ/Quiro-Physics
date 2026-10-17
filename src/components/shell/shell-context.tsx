"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

import { GUEST_VIEWER, type Viewer } from "@/shared/viewer";

interface ShellState {
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  /** Element focused when the palette opened — focus returns here on close. */
  paletteReturnFocus: React.RefObject<HTMLElement | null>;
  /** A page-level drawer (e.g. sources) is open: the app behind it becomes inert. */
  overlayOpen: boolean;
  setOverlayOpen: (open: boolean) => void;
  newChat: () => void;
  /** Signed-in state from the server (guest-only when accounts aren't configured). */
  viewer: Viewer;
}

const ShellContext = createContext<ShellState | null>(null);

export function ShellProvider({ children, viewer = GUEST_VIEWER }: { children: React.ReactNode; viewer?: Viewer }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpenState] = useState(false);
  const paletteReturnFocus = useRef<HTMLElement | null>(null);
  const setPaletteOpen = useCallback((open: boolean) => {
    if (open && document.activeElement instanceof HTMLElement)
      paletteReturnFocus.current = document.activeElement;
    setPaletteOpenState(open);
  }, []);
  const newChat = useCallback(() => {
    setMenuOpen(false);
    setPaletteOpenState(false);
    router.push(`/chat?new=${Date.now().toString(36)}`);
  }, [router]);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const value = useMemo(
    () => ({
      menuOpen,
      setMenuOpen,
      paletteOpen,
      setPaletteOpen,
      paletteReturnFocus,
      overlayOpen,
      setOverlayOpen,
      newChat,
      viewer,
    }),
    [menuOpen, paletteOpen, setPaletteOpen, overlayOpen, newChat, viewer],
  );
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

/** Same as useShell, but returns null outside the app shell (e.g. isolated component tests). */
export function useOptionalShell(): ShellState | null {
  return useContext(ShellContext);
}

export function useShell(): ShellState {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShell must be used inside <ShellProvider>");
  return ctx;
}
