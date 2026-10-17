import type { NextConfig } from "next";

import { validateEnvAtStartup } from "./src/config/env-schema";

// Fail fast: a bad env stops `next dev` / `next build` with a message naming the variable.
if (process.env.SKIP_ENV_VALIDATION !== "true") validateEnvAtStartup();

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // PGlite (local/e2e database) and its pgvector extension ship WASM + data files, and unpdf loads
  // pdf.js lazily: load them from node_modules at runtime instead of bundling.
  serverExternalPackages: ["@electric-sql/pglite", "@electric-sql/pglite-pgvector", "unpdf"],
};

export default nextConfig;
