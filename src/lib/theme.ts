import { MOTION_STORAGE_KEY, THEME_STORAGE_KEY, type ThemeName } from "./design-tokens";

/**
 * Runs synchronously in <head> before first paint (Next.js "preventing flash" pattern):
 * stored theme → else OS preference → else dark. Also applies the stored motion override.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var d=document.documentElement;var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"}d.setAttribute("data-theme",t);var m=localStorage.getItem("${MOTION_STORAGE_KEY}");if(m==="reduce"||m==="full")d.setAttribute("data-motion",m)}catch(e){}})()`;

export function readTheme(): ThemeName {
  if (typeof document === "undefined") return "dark";
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "light" || attr === "dark") return attr;
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {}
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function applyTheme(theme: ThemeName) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {}
  window.dispatchEvent(new CustomEvent("prc-theme-change", { detail: theme }));
}
