import "server-only";

import fs from "node:fs";
import path from "node:path";

import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { env } from "@/server/env";

import * as schema from "@/db/schema";

import { processSingleton } from "../singleton";

import { serializePGlite } from "./pglite-lock";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
export { schema };

export class DbUnavailableError extends Error {
  constructor() {
    super("Database is not configured (set DATABASE_URL, or PGLITE_DIR for a local database)");
    this.name = "DbUnavailableError";
  }
}

const MIGRATIONS = path.join(process.cwd(), "drizzle");

const dbSlot = processSingleton<Promise<Db>>("db");

/** Local fallback: development without DATABASE_URL uses an embedded PGlite in `.data/pglite`. */
function pgliteDir(): string | null {
  if (env.PGLITE_DIR) return env.PGLITE_DIR;
  if (env.NODE_ENV === "development") return path.join(process.cwd(), ".data", "pglite");
  return null;
}

export function isDbConfigured(): boolean {
  return Boolean(env.DATABASE_URL || pgliteDir());
}

async function connect(): Promise<Db> {
  if (env.DATABASE_URL) {
    // Neon over WebSockets: supports interactive transactions (the HTTP driver does not).
    const { Pool, neonConfig } = await import("@neondatabase/serverless");
    const { drizzle } = await import("drizzle-orm/neon-serverless");
    neonConfig.webSocketConstructor ??= globalThis.WebSocket;
    const pool = new Pool({ connectionString: env.DATABASE_URL });
    return drizzle({ client: pool, schema }) as unknown as Db;
  }
  const dir = pgliteDir();
  if (!dir) throw new DbUnavailableError();
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  // PGlite creates its own folder but not missing parents (e.g. ".e2e/").
  fs.mkdirSync(path.dirname(path.resolve(dir)), { recursive: true });
  const client = serializePGlite(new PGlite(dir));
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: MIGRATIONS }); // local databases migrate themselves
  return db as unknown as Db;
}

/** Shared database handle (created once per server instance). */
export function getDb(): Promise<Db> {
  let p = dbSlot.get();
  if (!p) {
    p = connect().catch((err) => {
      dbSlot.set(undefined);
      throw err;
    });
    dbSlot.set(p);
  }
  return p;
}

/** Tests inject a migrated in-memory PGlite. */
export function setDbForTests(db: Db | null) {
  dbSlot.set(db ? Promise.resolve(db) : undefined);
}
