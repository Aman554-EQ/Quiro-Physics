/**
 * Drizzle schema: documentation/DATABASE_SCHEMA.md. Pure (no `server-only`): drizzle-kit loads it.
 * Phase 2: users, chats, messages, memory, metrics. Phase 3: the document pipeline (upload ledger,
 * processing jobs, staging pages, chunks with halfvec embeddings + generated tsvector, citations).
 */
import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  customType,
  halfvec,
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
import type { ChunkEquation } from "@/shared/documents";
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
export const jobStage = pgEnum("job_stage", ["extract", "chunk", "embed", "finalize", "done"]);
export const chunkType = pgEnum("chunk_type", ["prose", "equation", "worked_example", "definition", "table", "summary"]);
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
    /** User-safe failure message. */
    error: text("error"),
    /** User-safe warning on a ready document (e.g. scanned pages that couldn't be read). */
    warning: text("warning"),
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
    chunkId: uuid("chunk_id").references(() => documentChunks.id, { onDelete: "set null" }),
    documentTitle: text("document_title").notNull(),
    pageStart: integer("page_start").notNull(),
    pageEnd: integer("page_end").notNull(),
    quote: text("quote").notNull(),
    score: real("score"),
  },
  (t) => [index("message_citations_message_idx").on(t.messageId)],
);

/** `tsvector` (no built-in Drizzle type). */
const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });

/** Immutable upload ledger: the weekly quota counts these rows (LIMITS_AND_QUOTAS.md §2). */
export const uploadEvents = pgTable(
  "upload_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("upload_events_owner_created_idx").on(t.userId, t.createdAt.desc()),
    uniqueIndex("upload_events_document_uq").on(t.documentId),
  ],
);

/** One resumable ingestion job per document, locked by a lease. */
export const documentProcessingJobs = pgTable("document_processing_jobs", {
  documentId: uuid("document_id")
    .primaryKey()
    .references(() => documents.id, { onDelete: "cascade" }),
  stage: jobStage("stage").default("extract").notNull(),
  cursor: integer("cursor").default(0).notNull(),
  total: integer("total"),
  attempts: integer("attempts").default(0).notNull(),
  leaseUntil: timestamp("lease_until", { withTimezone: true }),
  /** Internal only (never shown to users). */
  lastError: text("last_error"),
  updatedAt: updatedAt(),
});

/** Staging: extracted pages, purged once the document is ready. */
export const documentPages = pgTable(
  "document_pages",
  {
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    pageNumber: integer("page_number").notNull(),
    rawText: text("raw_text").notNull(),
    normalizedText: text("normalized_text").notNull(),
    isScanned: boolean("is_scanned").default(false).notNull(),
  },
  (t) => [primaryKey({ columns: [t.documentId, t.pageNumber] })],
);

export const documentChunks = pgTable(
  "document_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    /** Denormalised: every retrieval filters on it. */
    userId: uuid("user_id").notNull(),
    chunkIndex: integer("chunk_index").notNull(),
    chunkType: chunkType("chunk_type").notNull(),
    sectionPath: text("section_path"),
    pageStart: integer("page_start").notNull(),
    pageEnd: integer("page_end").notNull(),
    /** Display text. */
    content: text("content").notNull(),
    /** Contextual prefix + normalised text: what is embedded and indexed. */
    searchText: text("search_text").notNull(),
    equations: jsonb("equations").$type<ChunkEquation[]>().default(sql`'[]'::jsonb`).notNull(),
    tokenCount: integer("token_count").notNull(),
    embedding: halfvec("embedding", { dimensions: 768 }),
    tsv: tsvector("tsv").generatedAlwaysAs(sql`to_tsvector('english', search_text)`),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("chunks_doc_idx_uq").on(t.documentId, t.chunkIndex),
    index("chunks_owner_doc_idx").on(t.userId, t.documentId),
    index("chunks_tsv_idx").using("gin", t.tsv),
    index("chunks_pending_embed_idx").on(t.documentId, t.chunkIndex).where(sql`${t.embedding} is null`),
  ],
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
export type DocumentRow = typeof documents.$inferSelect;
export type JobRow = typeof documentProcessingJobs.$inferSelect;
export type ChunkRow = typeof documentChunks.$inferSelect;
