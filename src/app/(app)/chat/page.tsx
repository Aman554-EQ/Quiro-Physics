import type { Metadata } from "next";

import { ChatView } from "@/components/chat/ChatView";
import { MAX_MESSAGE_CHARS } from "@/shared/ui-message";

export const metadata: Metadata = { title: "Chat" };

export default async function ChatPage({ searchParams }: PageProps<"/chat">) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.slice(0, MAX_MESSAGE_CHARS) : "";
  const fresh = typeof params.new === "string" ? params.new : "";
  // `key` remounts the chat for "New chat" and for a new sample question.
  return <ChatView key={`${fresh}|${q}`} initialQuestion={q} />;
}
