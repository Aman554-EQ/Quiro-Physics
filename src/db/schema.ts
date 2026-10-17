/**
 * Drizzle schema: documentation/DATABASE_SCHEMA.md. Pure (no `server-only`): drizzle-kit loads it.
 * Phase 2 tables, plus `documents`, `conversation_documents` and `message_citations` so that
 * account and chat deletion cascade correctly from day one. Chunks, pages, jobs and upload
 * events arrive with Phase 3 (`message_citations.chunk_id` gets its FK then).
 */
import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type { PhysicsFacts } from "@/shared/memory";
import type { MessagePart } from "@/shared/ui-message";

const createdAt = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date());

// ---------- Enums ----------
export const messageRole = pgEnum("message_role", ["user", "assistant", "system"]);
export const messageStatus = pgEnum("message_status", ["streaming", "complete", "cancelled", "error"]);
export const documentStatus = pgEnum("document_status", [
  "reserved",
  "queued",
  "processing",
  "ready",
  "failed",
  "deleting",
]);
export const explanationLevel = pgEnum("explanation_level", ["intro", "intermediate", "advanced"]);
export const queryType = pgEnum("query_type", [
  "concept",
  "numerical",
  "derivation",
  "textbook_lookup",
  "follow_up",
  "mixed",
  "off_topic",
  "greeting",
]);

// ---------- Users ----------
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  email: text("email"),
  displayName: text("display_name"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const userPreferences = pgTable("user_preferences", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  explanationLevel: explanationLevel("explanation_level").default("intermediate").notNull(),
  showReasoning: boolean("show_reasoning").default(false).notNull(),
  unitsSystem: text("units_system").default("SI").notNull(),
  reducedMotion: boolean("reduced_motion"),
  updatedAt: updatedAt(),
});

// ---------- Conversations ----------
export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").default("New chat").notNull(),
    /** True once the user renamed it: automatic titles never overwrite it. */
    titleSetByUser: boolean("title_set_by_user").default(false).notNull(),
    pinned: boolean("pinned").default(false).notNull(),
    messageCount: integer("message_count").default(0).notNull(),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("conversations_owner_sort_idx").on(t.userId, t.pinned.desc(), t.lastMessageAt.desc())],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    role: messageRole("role").notNull(),
    /** Markdown with inline LaTeX: the provider-independent source of truth. */
    content: text("content").default("").notNull(),
    /** UI parts for exact re-hydration (text, reasoning, data-sources). */
    parts: jsonb("parts").$type<MessagePart[]>().default(sql`'[]'::jsonb`).notNull(),
    status: messageStatus("status").default("complete").notNull(),
    queryType: queryType("query_type"),
    model: text("model"),
    fallbackUsed: boolean("fallback_used").default(false).notNull(),
    promptTokens: integer("prompt_tokens"),
    completionTokens: integer("completion_tokens"),
    reasoningTokens: integer("reasoning_tokens"),
    latencyMs: integer("latency_ms"),
    firstTokenMs: integer("first_token_ms"),
    mathParseErrors: integer("math_parse_errors").default(0).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("messages_conversation_seq_uq").on(t.conversationId, t.seq),
    index("messages_user_created_idx").on(t.userId, t.createdAt),
  ],
);

export const conversationMemories = pgTable("conversation_memories", {
  conversationId: uuid("conversation_id")
    .primaryKey()
    .references(() => conversations.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  summary: text("summary").default("").notNull(),
  facts: jsonb("facts").$type<PhysicsFacts>().default(sql`'{}'::jsonb`).notNull(),
  summarizedThroughSeq: integer("summarized_through_seq").default(0).notNull(),
  version: integer("version").default(0).notNull(),
  updatedAt: updatedAt(),
});

// ---------- Documents (full lifecycle in Phase 3) ----------
export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    originalFilename: text("original_filename").notNull(),
    blobPathname: text("blob_pathname"),
    sizeBytes: integer("size_bytes").notNull(),
    pageCount: integer("page_count"),
    sha256: text("sha256"),
    status: documentStatus("status").default("reserved").notNull(),
    error: text("error"),
    scannedPages: integer("scanned_pages").default(0).notNull(),
    parserVersion: text("parser_version").notNull(),
    embeddingModel: text("embedding_model").notNull(),
    embeddingDim: integer("embedding_dim").notNull(),
    chunkCount: integer("chunk_count").default(0).notNull(),
    reservedAt: timestamp("reserved_at", { withTimezone: true }).defaultNow().notNull(),
    readyAt: timestamp("ready_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("documents_owner_status_idx").on(t.userId, t.status),
    uniqueIndex("documents_owner_sha_uq")
      .on(t.userId, t.sha256)
      .where(sql`${t.sha256} is not null and ${t.status} <> 'deleting'`),
  ],
);

export const conversationDocuments = pgTable(
  "conversation_documents",
  {
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.conversationId, t.documentId] })],
);

export const messageCitations = pgTable(
  "message_citations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    label: integer("label").notNull(),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
    /** FK to document_chunks (SET NULL) is added in Phase 3. */
    chunkId: uuid("chunk_id"),
    documentTitle: text("document_title").notNull(),
    pageStart: integer("page_start").notNull(),
    pageEnd: integer("page_end").notNull(),
    quote: text("quote").notNull(),
    score: real("score"),
  },
  (t) => [index("message_citations_message_idx").on(t.messageId)],
);

// ---------- Metrics ----------
export const modelUsage = pgTable(
  "model_usage",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    guestHash: text("guest_hash"),
    messageId: uuid("message_id"),
    purpose: text("purpose").notNull(),
    model: text("model").notNull(),
    promptTokens: integer("prompt_tokens"),
    completionTokens: integer("completion_tokens"),
    latencyMs: integer("latency_ms"),
    retries: integer("retries").default(0).notNull(),
    fallbackUsed: boolean("fallback_used").default(false).notNull(),
    errorCategory: text("error_category"),
    createdAt: createdAt(),
  },
  (t) => [index("model_usage_created_idx").on(t.createdAt)],
);

export type User = typeof users.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;
export type ConversationMemory = typeof conversationMemories.$inferSelect;
