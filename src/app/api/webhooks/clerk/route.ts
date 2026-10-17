import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { NextRequest } from "next/server";

import { getDb } from "@/server/db";
import { deleteUserByClerkId, upsertUserFromClerk } from "@/server/db/queries/users";
import { env } from "@/server/env";
import { jsonError, route } from "@/server/http";
import { logger } from "@/server/log";
import { deleteBlobs } from "@/server/storage/blob";

export const runtime = "nodejs";

interface ClerkUserData {
  id: string;
  email_addresses?: { id: string; email_address: string }[];
  primary_email_address_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
}

function profile(d: ClerkUserData) {
  const email =
    d.email_addresses?.find((e) => e.id === d.primary_email_address_id)?.email_address ??
    d.email_addresses?.[0]?.email_address ??
    null;
  const name = [d.first_name, d.last_name].filter(Boolean).join(" ") || d.username || null;
  return { clerkUserId: d.id, email, displayName: name };
}

/** Clerk → internal users table (svix-signed). Idempotent: Clerk may deliver an event twice. */
export const POST = route(async (req: Request) => {
  let evt: Awaited<ReturnType<typeof verifyWebhook>>;
  try {
    evt = await verifyWebhook(new NextRequest(req), { signingSecret: env.CLERK_WEBHOOK_SIGNING_SECRET });
  } catch {
    return jsonError(400, "INVALID_SIGNATURE", "Webhook signature could not be verified.");
  }
  const db = await getDb();
  switch (evt.type) {
    case "user.created":
    case "user.updated":
      await upsertUserFromClerk(db, profile(evt.data as unknown as ClerkUserData));
      break;
    case "user.deleted": {
      const id = (evt.data as { id?: string }).id;
      if (id) {
        const { blobPathnames } = await deleteUserByClerkId(db, id);
        await deleteBlobs(blobPathnames);
      }
      break;
    }
    default:
      break;
  }
  logger.info("webhook.clerk", { type: evt.type });
  return Response.json({ ok: true });
});
