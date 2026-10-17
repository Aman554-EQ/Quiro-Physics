import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

import { env } from "@/server/env";
import { logger } from "@/server/log";

/**
 * PDF storage behind one interface:
 * - Vercel Blob (private store) when BLOB_READ_WRITE_TOKEN is set: browsers upload directly
 *   (client upload), the server only reads, checks and deletes;
 * - a local folder (LOCAL_BLOB_DIR, default `.data/blobs`) in development without a token: the
 *   browser sends the file to `/api/documents/[id]/file`. Never used on Vercel (no disk).
 */
export interface BlobStore {
  readonly kind: "vercel" | "local" | "memory";
  head(pathname: string): Promise<{ size: number } | null>;
  read(pathname: string): Promise<Uint8Array | null>;
  /** Missing files are ignored. */
  del(pathnames: string[]): Promise<void>;
  /** Local/memory stores only (Vercel uploads go browser → Blob). */
  put?(pathname: string, bytes: Uint8Array): Promise<void>;
}

export const blobPathFor = (userId: string, documentId: string) => `u/${userId}/${documentId}.pdf`;

/** The uploaded pathname must be the reserved one, optionally with Blob's random suffix. */
export function isPathFor(pathname: string, userId: string, documentId: string) {
  const base = `u/${userId}/${documentId}`;
  return pathname === `${base}.pdf` || new RegExp(`^${base}-[A-Za-z0-9]{1,40}\\.pdf$`).test(pathname);
}

class VercelBlobStore implements BlobStore {
  readonly kind = "vercel" as const;
  constructor(private readonly token: string) {}
  async head(pathname: string) {
    const { head, BlobNotFoundError } = await import("@vercel/blob");
    try {
      const h = await head(pathname, { token: this.token });
      return { size: h.size };
    } catch (err) {
      if (err instanceof BlobNotFoundError) return null;
      throw err;
    }
  }
  async read(pathname: string) {
    const { get } = await import("@vercel/blob");
    const res = await get(pathname, { access: "private", token: this.token, useCache: false });
    if (!res || res.statusCode !== 200) return null;
    return new Uint8Array(await new Response(res.stream).arrayBuffer());
  }
  async del(pathnames: string[]) {
    if (!pathnames.length) return;
    const { del } = await import("@vercel/blob");
    await del(pathnames, { token: this.token });
  }
}

class LocalBlobStore implements BlobStore {
  readonly kind = "local" as const;
  constructor(private readonly root: string) {}
  private file(pathname: string) {
    const p = path.resolve(this.root, pathname);
    if (!p.startsWith(path.resolve(this.root) + path.sep)) throw new Error("Invalid blob path");
    return p;
  }
  async head(pathname: string) {
    try {
      return { size: (await fs.stat(this.file(pathname))).size };
    } catch {
      return null;
    }
  }
  async read(pathname: string) {
    try {
      return new Uint8Array(await fs.readFile(this.file(pathname)));
    } catch {
      return null;
    }
  }
  async del(pathnames: string[]) {
    await Promise.all(pathnames.map((p) => fs.rm(this.file(p), { force: true })));
  }
  async put(pathname: string, bytes: Uint8Array) {
    const f = this.file(pathname);
    await fs.mkdir(path.dirname(f), { recursive: true });
    await fs.writeFile(f, bytes);
  }
}

/** In-memory store for tests. */
export class MemoryBlobStore implements BlobStore {
  readonly kind = "memory" as const;
  readonly files = new Map<string, Uint8Array>();
  readonly deleted: string[] = [];
  async head(pathname: string) {
    const f = this.files.get(pathname);
    return f ? { size: f.byteLength } : null;
  }
  async read(pathname: string) {
    return this.files.get(pathname) ?? null;
  }
  async del(pathnames: string[]) {
    for (const p of pathnames) {
      this.deleted.push(p);
      this.files.delete(p);
    }
  }
  async put(pathname: string, bytes: Uint8Array) {
    this.files.set(pathname, bytes);
  }
}

let override: BlobStore | null = null;
let cached: BlobStore | null = null;

/** The configured store, or null when uploads aren't possible (Vercel without a Blob token). */
export function getBlobStore(): BlobStore | null {
  if (override) return override;
  if (cached) return cached;
  if (env.BLOB_READ_WRITE_TOKEN) cached = new VercelBlobStore(env.BLOB_READ_WRITE_TOKEN);
  else if (!process.env.VERCEL) cached = new LocalBlobStore(env.LOCAL_BLOB_DIR ?? path.join(process.cwd(), ".data", "blobs"));
  return cached;
}

export function setBlobStoreForTests(store: BlobStore | null) {
  override = store;
}

/** Delete files, never failing the caller (account deletion, document deletion, finalise). */
export async function deleteBlobs(pathnames: string[]): Promise<void> {
  const list = pathnames.filter(Boolean);
  if (list.length === 0) return;
  const store = getBlobStore();
  if (!store) return;
  try {
    await store.del(list);
    logger.info("blob.delete", { count: list.length });
  } catch (err) {
    logger.warn("blob.delete_failed", { count: list.length, name: (err as Error)?.name ?? "unknown" });
  }
}
