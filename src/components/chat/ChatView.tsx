"use client";

import { BookOpenText, PanelRightClose } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Drawer } from "vaul";

import { focusFirstIn } from "@/components/shell/MobileMenu";
import { useOptionalShell } from "@/components/shell/shell-context";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { usePhysicsChat } from "@/hooks/use-physics-chat";
import { createHttpTransport } from "@/lib/chat/http-transport";
import type { ChatTransport, ThreadRef } from "@/lib/chat/transport";
import { cn } from "@/lib/cn";
import { notifyConversationsChanged } from "@/lib/conversations-client";
import { saveConversationDocuments } from "@/lib/documents-client";
import { messageSources, type ChatMessage, type Source } from "@/shared/ui-message";

import { Composer, type ComposerHandle } from "./Composer";
import { DocumentSelector } from "./DocumentSelector";
import { EmptyChat } from "./EmptyChat";
import { GuestImportPrompt, rememberGuestThread } from "./GuestImportPrompt";
import { LimitBanner } from "./LimitBanner";
import { MessageList } from "./MessageList";
import { SourcesList } from "./Sources";

interface ChatViewProps {
  initialQuestion?: string;
  /** Injected for tests; defaults to the real /api/chat transport. */
  transport?: ChatTransport;
  /** Saved conversation (signed-in users on /chat/[id]). */
  initialMessages?: ChatMessage[];
  initialThread?: ThreadRef | null;
  /** Textbooks already selected for this conversation. */
  initialDocumentIds?: string[];
}

export function ChatView({
  initialQuestion = "",
  transport,
  initialMessages,
  initialThread = null,
  initialDocumentIds = [],
}: ChatViewProps) {
  const activeTransport = useMemo(() => transport ?? createHttpTransport(), [transport]);
  const shell = useOptionalShell();
  const signedIn = shell?.viewer.signedIn ?? false;
  const [documentIds, setDocumentIds] = useState<string[]>(initialDocumentIds);
  const chat = usePhysicsChat(activeTransport, {
    initialMessages,
    initialThread,
    documentIds: signedIn ? documentIds : [],
    onThread: (thread, isNew) => {
      if (thread.kind === "guest") rememberGuestThread(thread.id);
      // A new saved conversation gets its own URL without remounting the chat.
      if (thread.kind === "conversation" && isNew) {
        window.history.replaceState(null, "", `/chat/${thread.id}`);
        notifyConversationsChanged();
      }
    },
  });
  const [draft, setDraft] = useState(initialQuestion);
  const composerRef = useRef<ComposerHandle>(null);

  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const isWide = useMediaQuery("(min-width: 1280px)");
  const [panelOpen, setPanelOpen] = useState<boolean | null>(null); // null = automatic
  const [drawerOpen, setDrawerOpen] = useState(false);
  const setOverlayOpen = shell?.setOverlayOpen;
  useEffect(() => {
    setOverlayOpen?.(drawerOpen);
    return () => setOverlayOpen?.(false);
  }, [drawerOpen, setOverlayOpen]);
  const [selected, setSelected] = useState<number | null>(null);

  const sources: Source[] = useMemo(() => {
    for (let i = chat.messages.length - 1; i >= 0; i--) {
      const s = messageSources(chat.messages[i]!);
      if (s.length) return s;
    }
    return [];
  }, [chat.messages]);
  const showPanel = panelOpen ?? (isWide || sources.length > 0);

  const openSource = useCallback(
    (label: number) => {
      setSelected(label);
      if (isDesktop) setPanelOpen(true);
      else setDrawerOpen(true);
    },
    [isDesktop],
  );

  const chooseDocuments = (ids: string[]) => {
    setDocumentIds(ids);
    // A saved chat remembers its textbooks; a new one saves them with its first message.
    if (chat.thread?.kind === "conversation") void saveConversationDocuments(chat.thread.id, ids).catch(() => undefined);
  };

  const exhausted = chat.limit !== null && chat.limit.kind !== "rate" && chat.limit.remaining === 0;
  const send = () => {
    if (exhausted) return;
    if (chat.send(draft)) setDraft("");
  };
  const { reset } = chat;
  const newQuestion = useCallback(() => {
    reset();
    if (window.location.pathname !== "/chat") window.history.replaceState(null, "", "/chat");
    setDraft("");
    setSelected(null);
    composerRef.current?.focus();
  }, [reset]);

  // "/" focuses the composer (unless already typing somewhere).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      composerRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Single polite announcement per completed answer (never per token).
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAnnouncement(chat.completedId ? "Answer complete" : "");
  }, [chat.completedId]);

  // A new chat's title is written just after its first answer: refresh the lists once it lands.
  const savedThread = chat.thread?.kind === "conversation";
  useEffect(() => {
    if (!chat.completedId || !savedThread) return;
    const t = setTimeout(notifyConversationsChanged, 1_500);
    return () => clearTimeout(t);
  }, [chat.completedId, savedThread]);

  const turnsLeft = chat.limit?.kind === "guest_turns" ? chat.limit.remaining : null;
  const footer = signedIn
    ? chat.limit?.kind === "user_daily" && chat.limit.remaining <= 10
      ? `Saved to your history · ${chat.limit.remaining} messages left today`
      : "Saved to your history"
    : turnsLeft === null
      ? "Guest mode · 6 follow-ups per question"
      : `Guest mode · ${turnsLeft} of ${chat.limit!.limit} follow-ups left`;

  return (
    <div className="flex h-full min-h-0 w-full">
      <section className="flex min-w-0 flex-1 flex-col" aria-labelledby="chat-heading">
        <h1 id="chat-heading" className="sr-only">
          Chat
        </h1>
        <div className="hidden items-center justify-end px-4 pt-3 lg:flex">
          <button
            type="button"
            onClick={() => setPanelOpen(!showPanel)}
            aria-pressed={showPanel}
            aria-label={showPanel ? "Hide sources" : "Show sources"}
            className="border-border text-muted hover:text-text inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[13px]"
          >
            {showPanel ? (
              <PanelRightClose className="size-4" aria-hidden />
            ) : (
              <BookOpenText className="size-4" aria-hidden />
            )}
            Sources{sources.length ? ` (${sources.length})` : ""}
          </button>
        </div>

        <MessageList
          messages={chat.messages}
          onOpenSource={openSource}
          onRetry={chat.regenerate}
          onContinue={chat.continueAnswer}
          empty={
            <EmptyChat
              onPick={(q) => {
                setDraft(q);
                composerRef.current?.focus();
              }}
            />
          }
        />

        <div className="shrink-0 px-3 pt-2 pb-3 sm:px-6" data-print-hide>
          {signedIn && chat.messages.length === 0 && <GuestImportPrompt />}
          {signedIn && (
            <div className="mx-auto mb-2 flex w-full max-w-[820px]">
              <DocumentSelector value={documentIds} onChange={chooseDocuments} />
            </div>
          )}
          {chat.limit && (exhausted || chat.limit.remaining <= 1) && (
            <LimitBanner limit={chat.limit} onNewQuestion={newQuestion} signedIn={signedIn} />
          )}
          <Composer
            ref={composerRef}
            value={draft}
            onChange={setDraft}
            onSend={send}
            onStop={chat.stop}
            busy={chat.busy}
            disabled={exhausted}
            disabledReason={signedIn ? "You've reached today's message limit" : "Start a new question or sign in"}
            footer={footer}
          />
        </div>
        <div aria-live="polite" role="status" className="sr-only" data-testid="chat-announcer">
          {announcement}
        </div>
      </section>

      {/* Desktop sources column */}
      <aside
        data-testid="sources-panel"
        aria-label="Sources"
        className={cn(
          "border-border bg-surface/50 hidden shrink-0 border-l backdrop-blur-xl lg:block",
          showPanel ? "w-[360px]" : "w-0 overflow-hidden border-l-0",
        )}
        data-print-hide
      >
        {showPanel && (
          <SourcesList sources={sources} selected={selected} onClose={() => setPanelOpen(false)} />
        )}
      </aside>

      {/* Phone / tablet sources drawer */}
      {!isDesktop && (
        <Drawer.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
          <Drawer.Portal>
            <Drawer.Overlay className="fixed inset-0 z-40 bg-black/50" />
            <Drawer.Content
              onOpenAutoFocus={focusFirstIn}
              data-testid="sources-drawer"
              className="border-border bg-surface fixed inset-x-0 bottom-0 z-50 flex max-h-[80dvh] flex-col rounded-t-[var(--radius-lg)] border-t outline-none"
              style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            >
              <div aria-hidden className="bg-border mx-auto mt-2.5 h-1.5 w-10 rounded-full" />
              <Drawer.Title className="sr-only">Sources</Drawer.Title>
              <Drawer.Description className="sr-only">
                Textbook passages used in the answer
              </Drawer.Description>
              <SourcesList sources={sources} selected={selected} onClose={() => setDrawerOpen(false)} />
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      )}
    </div>
  );
}
