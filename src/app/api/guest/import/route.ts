import { z } from "zod";

import { requireUser } from "@/server/auth/require-user";
import { importGuestThread } from "@/server/chat/guest-import";
import { getDb } from "@/server/db";
import { route } from "@/server/http";
import { getKV } from "@/server/kv";
import { GUEST_COOKIE, verifyGuestCookie } from "@/server/limits/guest-identity";

export const runtime = "nodejs";

const BodySchema = z.object({ guestThreadId: z.string().uuid() });

function guestIdFrom(req: Request) {
  const cookie = (req.headers.get("cookie") ?? "")
    .split(/;\s*/)
    .find((c) => c.startsWith(`${GUEST_COOKIE}=`))
    ?.slice(GUEST_COOKIE.length + 1);
  return verifyGuestCookie(cookie ? decodeURIComponent(cookie) : null);
}

/** Save the caller's guest thread into their history. */
export const POST = route(async (req: Request) => {
  const { userId } = await requireUser();
  const { guestThreadId } = BodySchema.parse(await req.json());
  const conversationId = await importGuestThread(await getDb(), getKV(), {
    userId,
    guestId: guestIdFrom(req),
    threadId: guestThreadId,
  });
  return Response.json({ conversationId }, { status: 201 });
});
