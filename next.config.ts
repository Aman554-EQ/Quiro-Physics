import type { NextConfig } from "next";

import { validateEnvAtStartup } from "./src/config/env-schema";

// Fail fast: a bad env stops `next dev` / `next build` with a message naming the variable.
if (process.env.SKIP_ENV_VALIDATION !== "true") validateEnvAtStartup();

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // PGlite (local/e2e database) ships WASM + data files: load it from node_modules at runtime.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
