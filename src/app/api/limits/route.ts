import { getOptionalUser } from "@/server/auth/require-user";
import { getDb } from "@/server/db";
import { env } from "@/server/env";
import { route } from "@/server/http";
import { getKV } from "@/server/kv";
import { clientIp, ipHash, resolveGuest } from "@/server/limits/guest-identity";
import { threadsToday } from "@/server/limits/guest-threads";
import { dailyMessageUsage } from "@/server/limits/user-limits";
import type { LimitsResponse } from "@/shared/chat-api";

export const runtime = "nodejs";

/** Current usage and reset times (LIMITS_AND_QUOTAS.md §4). Never sets a guest cookie. */
export const GET = route(async (req: Request) => {
  const user = await getOptionalUser();
  if (user) {
    const messages = await dailyMessageUsage(await getDb(), user.userId);
    const body: LimitsResponse = {
      kind: "user",
      messages,
      // PDF quotas go live in Phase 3.
      uploads: { used: 0, limit: env.UPLOAD_QUOTA_PER_WEEK, nextSlotAt: null },
      active: { used: 0, limit: env.MAX_ACTIVE_DOCUMENTS },
    };
    return Response.json(body);
  }
  const { guestId } = resolveGuest(req);
  const threads = await threadsToday(getKV(), guestId, ipHash(clientIp(req)));
  const body: LimitsResponse = {
    kind: "guest",
    turnsPerThread: env.GUEST_MAX_TURNS_PER_THREAD,
    threads: {
      used: threads.used,
      limit: env.GUEST_MAX_THREADS_PER_DAY,
      resetAt: threads.used > 0 ? threads.resetAt : null,
    },
  };
  return Response.json(body);
});
