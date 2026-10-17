"use client";

import { useSyncExternalStore } from "react";

import type { ThemeName } from "@/lib/design-tokens";
import { applyTheme, readTheme } from "@/lib/theme";

function subscribe(onChange: () => void) {
  window.addEventListener("prc-theme-change", onChange);
  return () => window.removeEventListener("prc-theme-change", onChange);
}

export function useTheme(): [ThemeName, (t: ThemeName) => void, () => void] {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "dark" as const);
  return [theme, applyTheme, () => applyTheme(theme === "dark" ? "light" : "dark")];
}
