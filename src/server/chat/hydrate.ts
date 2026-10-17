import "server-only";

import type { MessageRow } from "@/db/schema";
import type { ChatMessage, RouteInfo } from "@/shared/ui-message";

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
