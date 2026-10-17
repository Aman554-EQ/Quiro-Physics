import "server-only";

import { and, eq, inArray, ne } from "drizzle-orm";

import { documents, type MessageRow } from "@/db/schema";
import type { Db } from "@/server/db";
import type { ChatMessage, RouteInfo, Source } from "@/shared/ui-message";

/** A saved row → the client's ChatMessage, restored exactly from its parts (P2-S4-A11). */
export function rowToChatMessage(row: Pick<MessageRow, "id" | "role" | "content" | "parts" | "status">): ChatMessage {
  const parts = row.parts?.length ? row.parts : row.content ? [{ type: "text" as const, text: row.content }] : [];
  // A row still `streaming` here was interrupted or is being written in another tab.
  const status = row.status === "streaming" ? "error" : row.status;
  const route = (parts.find((p) => p.type === "data-route") as { data: RouteInfo } | undefined)?.data;
  return {
    id: row.id,
    role: row.role === "user" ? "user" : "assistant",
    parts,
    status,
    meta: {
      ...(route ? { route } : {}),
      ...(row.status === "streaming"
        ? { error: "This answer was interrupted or is still being written. Reload in a moment." }
        : {}),
    },
  };
}

/**
 * Sources whose document was deleted render as "source deleted": the snapshot (title, pages,
 * quote) stays, the link to the document goes (P3-S6-A13).
 */
/** Demo-tutor sample sources use ids like "demo-mechanics": they are never looked up. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function withSourceStatus(db: Db, userId: string, list: ChatMessage[]): Promise<ChatMessage[]> {
  const ids = new Set<string>();
  for (const m of list)
    for (const p of m.parts)
      if (p.type === "data-sources")
        for (const s of (p as { data: Source[] }).data) if (s.documentId && UUID.test(s.documentId)) ids.add(s.documentId);
  if (!ids.size) return list;
  const alive = new Set(
    (
      await db
        .select({ id: documents.id })
        .from(documents)
        .where(and(eq(documents.userId, userId), inArray(documents.id, [...ids]), ne(documents.status, "deleting")))
    ).map((r) => r.id),
  );
  return list.map((m) => ({
    ...m,
    parts: m.parts.map((p) =>
      p.type === "data-sources"
        ? {
            ...p,
            data: (p as { data: Source[] }).data.map((s) =>
              s.documentId && UUID.test(s.documentId) && !alive.has(s.documentId) ? { ...s, documentId: null, deleted: true } : s,
            ),
          }
        : p,
    ),
  }));
}
