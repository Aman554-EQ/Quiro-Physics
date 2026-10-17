import "server-only";

/**
 * The small Redis subset the app uses (guest threads, limit counters, model budgets).
 * Production: Upstash Redis REST (`@upstash/redis` has the same method names and auto-(de)serialises JSON).
 * Local dev / tests: `MemoryKV`. Nothing stored here is needed to rebuild a signed-in user's history.
 */
export interface KV {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown, opts?: { ex?: number; px?: number; nx?: boolean }): Promise<"OK" | null>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  pexpire(key: string, ms: number): Promise<number>;
  /** Seconds to live; -1 = no expiry, -2 = missing (Redis semantics). */
  ttl(key: string): Promise<number>;
  del(...keys: string[]): Promise<number>;
}

interface Entry {
  value: string;
  expiresAt: number | null;
}

/** In-memory KV with Redis semantics. Time comes from `Date.now()`, so Vitest fake timers drive expiry. */
export class MemoryKV implements KV {
  private store = new Map<string, Entry>();

  private live(key: string): Entry | undefined {
    const e = this.store.get(key);
    if (e && e.expiresAt !== null && e.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return e;
  }

  async get<T>(key: string): Promise<T | null> {
    const e = this.live(key);
    if (!e) return null;
    try {
      return JSON.parse(e.value) as T;
    } catch {
      return e.value as T;
    }
  }

  async set(key: string, value: unknown, opts: { ex?: number; px?: number; nx?: boolean } = {}) {
    if (opts.nx && this.live(key)) return null;
    const ttlMs = opts.px ?? (opts.ex !== undefined ? opts.ex * 1000 : undefined);
    this.store.set(key, {
      value: typeof value === "string" ? JSON.stringify(value) : JSON.stringify(value),
      expiresAt: ttlMs !== undefined ? Date.now() + ttlMs : null,
    });
    return "OK" as const;
  }

  async incr(key: string) {
    const e = this.live(key);
    const next = (e ? Number(JSON.parse(e.value)) : 0) + 1;
    this.store.set(key, { value: JSON.stringify(next), expiresAt: e?.expiresAt ?? null });
    return next;
  }

  async expire(key: string, seconds: number) {
    return this.pexpire(key, seconds * 1000);
  }

  async pexpire(key: string, ms: number) {
    const e = this.live(key);
    if (!e) return 0;
    e.expiresAt = Date.now() + ms;
    return 1;
  }

  async ttl(key: string) {
    const e = this.live(key);
    if (!e) return -2;
    if (e.expiresAt === null) return -1;
    return Math.ceil((e.expiresAt - Date.now()) / 1000);
  }

  async del(...keys: string[]) {
    let n = 0;
    for (const k of keys) if (this.store.delete(k)) n++;
    return n;
  }

  /** Test helper: every live key with its raw stored value. */
  dump(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const k of [...this.store.keys()]) {
      const e = this.live(k);
      if (e) out[k] = e.value;
    }
    return out;
  }

  clear() {
    this.store.clear();
  }
}
