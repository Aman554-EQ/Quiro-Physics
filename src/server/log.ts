import "server-only";

/**
 * Structured logs: ids, counts, timings and categories only (SECURITY.md S9).
 * Never pass prompt text, answers, API keys or raw IPs. As a safety net, string values that look
 * like secrets are redacted and long strings are truncated.
 */
type Fields = Record<string, string | number | boolean | null | undefined>;

const SECRET_RE = /(gsk_|sk_live_|sk_test_|whsec_|Bearer\s+)[A-Za-z0-9._-]+/g;
const MAX_STRING = 120;

export function redact(fields: Fields): Fields {
  const out: Fields = {};
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v !== "string") {
      out[k] = v;
      continue;
    }
    const clean = v.replace(SECRET_RE, "$1[redacted]");
    out[k] = clean.length > MAX_STRING ? `${clean.slice(0, MAX_STRING)}…` : clean;
  }
  return out;
}

function emit(level: "info" | "warn" | "error", event: string, fields: Fields = {}) {
  const line = JSON.stringify({ level, event, ...redact(fields) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

/** Methods are properties so tests can `vi.spyOn(logger, "info")`. */
export const logger = {
  info: (event: string, fields?: Fields) => emit("info", event, fields),
  warn: (event: string, fields?: Fields) => emit("warn", event, fields),
  error: (event: string, fields?: Fields) => emit("error", event, fields),
};
