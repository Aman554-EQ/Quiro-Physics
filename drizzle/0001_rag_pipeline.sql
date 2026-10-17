-- pgvector (halfvec). Neon and PGlite (with @electric-sql/pglite-pgvector) both ship it.
CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TYPE "public"."chunk_type" AS ENUM('prose', 'equation', 'worked_example', 'definition', 'table', 'summary');--> statement-breakpoint
CREATE TYPE "public"."job_stage" AS ENUM('extract', 'chunk', 'embed', 'finalize', 'done');--> statement-breakpoint
CREATE TABLE "document_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"chunk_type" "chunk_type" NOT NULL,
	"section_path" text,
	"page_start" integer NOT NULL,
	"page_end" integer NOT NULL,
	"content" text NOT NULL,
	"search_text" text NOT NULL,
	"equations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"token_count" integer NOT NULL,
	"embedding" halfvec(768),
	"tsv" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', search_text)) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_pages" (
	"document_id" uuid NOT NULL,
	"page_number" integer NOT NULL,
	"raw_text" text NOT NULL,
	"normalized_text" text NOT NULL,
	"is_scanned" boolean DEFAULT false NOT NULL,
	CONSTRAINT "document_pages_document_id_page_number_pk" PRIMARY KEY("document_id","page_number")
);
--> statement-breakpoint
CREATE TABLE "document_processing_jobs" (
	"document_id" uuid PRIMARY KEY NOT NULL,
	"stage" "job_stage" DEFAULT 'extract' NOT NULL,
	"cursor" integer DEFAULT 0 NOT NULL,
	"total" integer,
	"attempts" integer DEFAULT 0 NOT NULL,
	"lease_until" timestamp with time zone,
	"last_error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "upload_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"document_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "warning" text;--> statement-breakpoint
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_pages" ADD CONSTRAINT "document_pages_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_processing_jobs" ADD CONSTRAINT "document_processing_jobs_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_events" ADD CONSTRAINT "upload_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_events" ADD CONSTRAINT "upload_events_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "chunks_doc_idx_uq" ON "document_chunks" USING btree ("document_id","chunk_index");--> statement-breakpoint
CREATE INDEX "chunks_owner_doc_idx" ON "document_chunks" USING btree ("user_id","document_id");--> statement-breakpoint
CREATE INDEX "chunks_tsv_idx" ON "document_chunks" USING gin ("tsv");--> statement-breakpoint
CREATE INDEX "chunks_pending_embed_idx" ON "document_chunks" USING btree ("document_id","chunk_index") WHERE "document_chunks"."embedding" is null;--> statement-breakpoint
CREATE INDEX "upload_events_owner_created_idx" ON "upload_events" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "upload_events_document_uq" ON "upload_events" USING btree ("document_id");--> statement-breakpoint
ALTER TABLE "message_citations" ADD CONSTRAINT "message_citations_chunk_id_document_chunks_id_fk" FOREIGN KEY ("chunk_id") REFERENCES "public"."document_chunks"("id") ON DELETE set null ON UPDATE no action;