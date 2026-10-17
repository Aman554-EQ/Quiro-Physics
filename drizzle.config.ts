import fs from "node:fs";

import { defineConfig } from "drizzle-kit";

// `pnpm db:generate` needs no database. `pnpm db:migrate` applies `drizzle/` to Neon using the
// direct (unpooled) connection from .env.local.
if (fs.existsSync(".env.local")) process.loadEnvFile(".env.local");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || "" },
  strict: true,
});
