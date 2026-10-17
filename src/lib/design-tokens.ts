/**
 * Colour tokens for both themes (OKLCH). Mirrors the CSS variables in
 * `src/app/globals.css`; a test keeps the two in sync and checks WCAG contrast.
 */
export const THEMES = ["dark", "light"] as const;
export type ThemeName = (typeof THEMES)[number];

export const COLOR_TOKENS = {
  bg: {
    dark: "oklch(0.16 0.03 265)",
    light: "oklch(0.985 0.005 250)",
    role: "Page background (deep space / paper)",
  },
  surface: { dark: "oklch(0.21 0.035 265)", light: "oklch(1 0 0)", role: "Cards, panels" },
  "surface-2": {
    dark: "oklch(0.25 0.04 265)",
    light: "oklch(0.96 0.01 250)",
    role: "Raised / glass surfaces",
  },
  border: { dark: "oklch(0.33 0.04 265)", light: "oklch(0.88 0.015 255)", role: "Hairlines" },
  text: { dark: "oklch(0.95 0.01 250)", light: "oklch(0.22 0.03 265)", role: "Body text" },
  muted: { dark: "oklch(0.75 0.02 255)", light: "oklch(0.46 0.02 260)", role: "Secondary text" },
  field: {
    dark: "oklch(0.80 0.13 210)",
    light: "oklch(0.50 0.14 225)",
    role: "Primary accent (cyan field lines)",
  },
  "on-field": { dark: "oklch(0.18 0.03 265)", light: "oklch(0.99 0 0)", role: "Text on primary accent" },
  photon: {
    dark: "oklch(0.72 0.17 295)",
    light: "oklch(0.50 0.19 295)",
    role: "Secondary accent (violet photons)",
  },
  energy: { dark: "oklch(0.82 0.15 75)", light: "oklch(0.55 0.15 65)", role: "Highlights, warnings (amber)" },
  danger: { dark: "oklch(0.70 0.19 25)", light: "oklch(0.53 0.2 25)", role: "Errors, destructive actions" },
} as const;

export type ColorToken = keyof typeof COLOR_TOKENS;
export const COLOR_TOKEN_NAMES = Object.keys(COLOR_TOKENS) as ColorToken[];

/** Pairs that must meet WCAG contrast in both themes: [foreground, background, minimum ratio]. */
export const CONTRAST_REQUIREMENTS: ReadonlyArray<readonly [ColorToken, ColorToken, number]> = [
  ["text", "bg", 4.5],
  ["text", "surface", 4.5],
  ["text", "surface-2", 4.5],
  ["muted", "bg", 4.5],
  ["muted", "surface", 4.5],
  ["field", "bg", 3],
  ["photon", "bg", 3],
  ["danger", "bg", 3],
  ["energy", "bg", 3],
  ["on-field", "field", 4.5],
];

export const THEME_STORAGE_KEY = "prc-theme";
export const MOTION_STORAGE_KEY = "prc-motion";
