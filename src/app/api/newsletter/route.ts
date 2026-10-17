import { getKV } from "@/server/kv";
import { jsonError, route } from "@/server/http";
import { clientIp, ipHash } from "@/server/limits/guest-identity";
import { slidingWindow } from "@/server/limits/rate-limit";
import { logger } from "@/server/log";
import { NEWSLETTER_RATE, NewsletterSchema, subscribe } from "@/server/newsletter";

export const runtime = "nodejs";

/** Footer email sign-up. Public; rate limited per IP (hashed); a filled honeypot looks successful. */
export const POST = route(async (req: Request) => {
  const parsed = NewsletterSchema.safeParse(await req.json());
  if (!parsed.success) return jsonError(400, "INVALID_EMAIL", "Please enter a valid email address.");
  const { email, website } = parsed.data;
  if (website) return Response.json({ status: "subscribed" });

  const kv = getKV();
  const rate = await slidingWindow(kv, `newsletter:${ipHash(clientIp(req))}`, NEWSLETTER_RATE.limit, NEWSLETTER_RATE.windowMs);
  if (!rate.ok) return jsonError(429, "RATE_LIMITED", "Too many sign-ups from here. Please try again later.", rate.resetAt);

  const status = await subscribe(kv, email);
  logger.info("newsletter.subscribe", { status });
  return Response.json({ status });
});
