import "server-only";

/**
 * One instance per server process. Next bundles each route and page separately, so a plain
 * module-level `let` can exist several times in one process: two embedded PGlite databases on
 * the same folder (stale reads), or rate limits split per route. `globalThis` is shared by all.
 */
const store = globalThis as unknown as { __quiro?: Map<string, unknown> };

export function processSingleton<T>(key: string) {
  store.__quiro ??= new Map();
  const map = store.__quiro;
  return {
    get: () => map.get(key) as T | undefined,
    set: (value: T | undefined) => {
      if (value === undefined) map.delete(key);
      else map.set(key, value);
    },
  };
}
