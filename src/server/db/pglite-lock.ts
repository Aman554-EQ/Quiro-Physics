import "server-only";

import type { PGlite } from "@electric-sql/pglite";

/**
 * PGlite is a single in-process connection. Without care, a query from request B runs *inside*
 * request A's open transaction (same session) and is lost if A rolls back. Neon has real
 * connections and doesn't need this; for the local/e2e PGlite every top-level query and
 * transaction is serialised through one mutex. Queries made through a transaction's own `tx`
 * object don't go through the wrapper, so transactions can't deadlock on themselves.
 */
export function serializePGlite(client: PGlite): PGlite {
  let tail: Promise<unknown> = Promise.resolve();
  const exclusive = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = tail.then(fn, fn);
    tail = run.catch(() => undefined);
    return run;
  };
  return new Proxy(client, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== "function") return value;
      if (prop === "query" || prop === "exec" || prop === "transaction" || prop === "sql")
        return (...args: unknown[]) => exclusive(() => (value as (...a: unknown[]) => Promise<unknown>).apply(target, args));
      return value.bind(target);
    },
  });
}
