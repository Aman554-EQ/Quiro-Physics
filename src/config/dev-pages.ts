/**
 * Dev-only pages (/dev/tokens, /dev/math, /dev/throw) are available in development,
 * or in a production build only when ENABLE_DEV_PAGES=true (used by the e2e build).
 * On a normal production deployment they return 404.
 */
export function isDevPagesEnabled(raw: Record<string, string | undefined> = process.env): boolean {
  if (raw.NODE_ENV !== "production") return true;
  return raw.ENABLE_DEV_PAGES === "true" || raw.ENABLE_DEV_PAGES === "1";
}
