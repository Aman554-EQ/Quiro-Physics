/**
 * Which paths need a signed-in user (P2-S2-A11). Pure, so `proxy.ts` and tests share it.
 * The proxy is the first line only: every protected handler also calls `requireUser()` (SECURITY S1).
 */
const PROTECTED_PAGES = ["/history", "/library", "/settings"];
const PROTECTED_API = ["/api/conversations", "/api/documents", "/api/guest/import"];

const under = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);

export function isProtectedPage(pathname: string) {
  return PROTECTED_PAGES.some((b) => under(pathname, b));
}

/** Authenticated by the handler itself (internal job secret or the owner's session). */
const SELF_AUTHENTICATED_API = /^\/api\/documents\/[^/]+\/process$/;

export function isProtectedApi(pathname: string) {
  return PROTECTED_API.some((b) => under(pathname, b)) && !SELF_AUTHENTICATED_API.test(pathname);
}

export function isProtectedPath(pathname: string) {
  return isProtectedPage(pathname) || isProtectedApi(pathname);
}

/** Where a signed-out visitor to a protected page is sent (with a way back). */
export function signInRedirect(pathname: string, search = "") {
  return `/sign-in?redirect_url=${encodeURIComponent(pathname + search)}`;
}
