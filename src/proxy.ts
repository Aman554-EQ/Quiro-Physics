import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

import { isProtectedApi, isProtectedPath, signInRedirect } from "@/config/auth-routes";
import { TEST_SESSION_COOKIE, verifyTestSession } from "@/config/test-session";

/**
 * First line of auth (SECURITY S1): protected pages redirect to sign-in, protected APIs answer 401.
 * Every protected handler still calls `requireUser()` itself.
 *
 * - Clerk keys set → `clerkMiddleware` (also required for `auth()` in handlers).
 * - E2E_TEST_AUTH → the signed test cookie (Playwright; refused on Vercel by env validation).
 * - Neither → guest-only app: protected routes always need sign-in.
 */
const testAuth = process.env.E2E_TEST_AUTH === "true" || process.env.E2E_TEST_AUTH === "1";
const clerkConfigured =
  !testAuth && Boolean(process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

function deny(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (isProtectedApi(pathname))
    return Response.json(
      { error: { code: "SIGN_IN_REQUIRED", message: "Please sign in to do that." } },
      { status: 401 },
    );
  return NextResponse.redirect(new URL(signInRedirect(pathname, search), req.url));
}

const withClerk = clerkMiddleware(async (auth, req) => {
  if (!isProtectedPath(req.nextUrl.pathname)) return;
  const { userId } = await auth();
  if (!userId) return deny(req);
});

export default function proxy(req: NextRequest, event: NextFetchEvent) {
  if (clerkConfigured) return withClerk(req, event);
  if (!isProtectedPath(req.nextUrl.pathname)) return NextResponse.next();
  const signedIn =
    testAuth &&
    verifyTestSession(req.cookies.get(TEST_SESSION_COOKIE)?.value, process.env.ANON_COOKIE_SECRET || undefined);
  return signedIn ? NextResponse.next() : deny(req);
}

export const config = {
  matcher: [
    // Skip Next internals and static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
