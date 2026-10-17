import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { ChatView } from "@/components/chat/ChatView";
import { signInRedirect } from "@/config/auth-routes";
import { getOptionalUser } from "@/server/auth/require-user";
import { rowToChatMessage } from "@/server/chat/hydrate";
import { listMessages, sweepStaleStreaming } from "@/server/chat/persistence";
import { getDb } from "@/server/db";
import { getConversation } from "@/server/db/queries/conversations";

export const metadata: Metadata = { title: "Chat" };

/** A saved conversation. Someone else's id (or a deleted chat) is simply not found. */
export default async function SavedChatPage({ params }: PageProps<"/chat/[id]">) {
  const { id } = await params;
  const user = await getOptionalUser();
  if (!user) redirect(signInRedirect(`/chat/${id}`));
  const db = await getDb();
  const conversation = await getConversation(db, user.userId, id);
  if (!conversation) notFound();
  await sweepStaleStreaming(db, { conversationId: id });
  const rows = await listMessages(db, user.userId, id);
  return (
    <ChatView
      key={id}
      initialMessages={rows.map(rowToChatMessage)}
      initialThread={{ kind: "conversation", id }}
    />
  );
}
