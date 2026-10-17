import "server-only";

import { ZodError } from "zod";

import { UnauthorizedError } from "@/server/auth/require-user";
import { DbUnavailableError } from "@/server/db";
import { logger } from "@/server/log";
import { CapacityError } from "@/server/models/errors";

/**
 * Every API error is JSON `{ error: { code, message, resetAt? } }` (API.md). Messages are written
 * for people; stack traces, SQL and file paths never leave the server (P2-S3-A13).
 */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly resetAt?: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

/** Ownership failures are 404, never 403, so ids can't be probed (API.md). */
export class NotFoundError extends AppError {
  constructor(what = "Conversation") {
    super(404, "NOT_FOUND", `${what} not found`);
  }
}

export function jsonError(status: number, code: string, message: string, resetAt?: string) {
  return Response.json({ error: { code, message, ...(resetAt ? { resetAt } : {}) } }, { status });
}

export function toErrorResponse(err: unknown): Response {
  if (err instanceof AppError) return jsonError(err.status, err.code, err.message, err.resetAt);
  if (err instanceof UnauthorizedError) return jsonError(401, "SIGN_IN_REQUIRED", "Please sign in to do that.");
  if (err instanceof ZodError) {
    const field = err.issues[0]?.path.join(".") || "request";
    return jsonError(400, "INVALID_REQUEST", `Invalid ${field}.`);
  }
  if (err instanceof SyntaxError) return jsonError(400, "INVALID_REQUEST", "The request body isn't valid JSON.");
  if (err instanceof CapacityError)
    return jsonError(
      503,
      "MODEL_CAPACITY",
      "The tutor is busy right now (free-tier capacity). Please try again shortly.",
      err.resetAt,
    );
  if (err instanceof DbUnavailableError)
    return jsonError(503, "SERVICE_UNAVAILABLE", "Saved chats aren't available on this server yet.");
  const e = err as (Error & { code?: string; cause?: unknown }) | undefined;
  logger.error("api.unhandled", {
    name: e?.name ?? "unknown",
    code: typeof e?.code === "string" ? e.code : null,
    // Messages can quote SQL parameters (user text), so they are logged only off production.
    detail: process.env.NODE_ENV !== "production" || process.env.E2E ? String(e?.message ?? "").split("\n")[0] : null,
  });
  return jsonError(500, "INTERNAL_ERROR", "Something went wrong on our side. Please try again.");
}

/** Wrap a route handler so thrown errors become safe JSON responses. */
export function route<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}
