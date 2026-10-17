import { handleChat } from "@/server/chat/orchestrator";
import { route } from "@/server/http";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Stream an answer (UI message stream over SSE). See STREAMING.md §4. */
export const POST = route(handleChat);
