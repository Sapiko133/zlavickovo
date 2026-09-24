/**
 * Minimálne KV rozhranie nad Upstash Redis. Automatizačné moduly (feed engine,
 * Facebook queue, job log, alerty, link health) pracujú cez neho, aby sa dali
 * testovať proti in-memory implementácii bez siete (scripts/test-*.ts).
 *
 * Hodnoty sú JSON-serializovateľné objekty — Upstash klient ich serializuje sám.
 */
import { redis } from "@/lib/redis";

export interface Kv {
  get<T>(key: string): Promise<T | null>;
  /** Vráti true, keď sa hodnota zapísala (pri nx=false vždy true). */
  set(key: string, value: unknown, opts?: { ex?: number; nx?: boolean }): Promise<boolean>;
  del(...keys: string[]): Promise<void>;
  expire(key: string, seconds: number): Promise<void>;
  hget<T>(key: string, field: string): Promise<T | null>;
  hgetall<T>(key: string): Promise<Record<string, T> | null>;
  hset(key: string, values: Record<string, unknown>): Promise<void>;
  hdel(key: string, ...fields: string[]): Promise<void>;
  lpush(key: string, value: unknown): Promise<void>;
  ltrim(key: string, start: number, stop: number): Promise<void>;
  lrange<T>(key: string, start: number, stop: number): Promise<T[]>;
  incr(key: string): Promise<number>;
}

export const redisKv: Kv = {
  async get<T>(key: string) {
    return (await redis.get<T>(key)) ?? null;
  },
  async set(key, value, opts = {}) {
    const res = opts.nx
      ? await redis.set(key, value, opts.ex ? { nx: true, ex: opts.ex } : { nx: true })
      : await redis.set(key, value, opts.ex ? { ex: opts.ex } : undefined);
    return res !== null;
  },
  async del(...keys) {
    if (keys.length) await redis.del(...keys);
  },
  async expire(key, seconds) {
    await redis.expire(key, seconds);
  },
  async hget<T>(key: string, field: string) {
    return (await redis.hget<T>(key, field)) ?? null;
  },
  async hgetall<T>(key: string) {
    return (await redis.hgetall<Record<string, T>>(key)) ?? null;
  },
  async hset(key, values) {
    if (Object.keys(values).length) await redis.hset(key, values);
  },
  async hdel(key, ...fields) {
    if (fields.length) await redis.hdel(key, ...fields);
  },
  async lpush(key, value) {
    await redis.lpush(key, value);
  },
  async ltrim(key, start, stop) {
    await redis.ltrim(key, start, stop);
  },
  async lrange<T>(key: string, start: number, stop: number) {
    return ((await redis.lrange(key, start, stop)) ?? []) as T[];
  },
  async incr(key) {
    return redis.incr(key);
  },
};

/** In-memory KV pre testy (a dry-run). Kopíruje hodnoty cez JSON ako Redis. */
export function createMemoryKv(): Kv & { dump(): Record<string, unknown>; writes: number } {
  const store = new Map<string, unknown>();
  const expiry = new Map<string, number>();
  const clone = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
  const alive = (key: string) => {
    const at = expiry.get(key);
    if (at !== undefined && at <= Date.now()) {
      store.delete(key);
      expiry.delete(key);
    }
    return store.has(key);
  };
  const kv = {
    writes: 0,
    dump: () => Object.fromEntries([...store.keys()].filter(alive).map((k) => [k, clone(store.get(k))])),
    async get<T>(key: string) {
      return alive(key) ? (clone(store.get(key)) as T) : null;
    },
    async set(key: string, value: unknown, opts: { ex?: number; nx?: boolean } = {}) {
      if (opts.nx && alive(key)) return false;
      kv.writes++;
      store.set(key, clone(value));
      if (opts.ex) expiry.set(key, Date.now() + opts.ex * 1000);
      else expiry.delete(key);
      return true;
    },
    async del(...keys: string[]) {
      for (const k of keys) { store.delete(k); expiry.delete(k); }
    },
    async expire(key: string, seconds: number) {
      if (alive(key)) expiry.set(key, Date.now() + seconds * 1000);
    },
    async hget<T>(key: string, field: string) {
      const h = alive(key) ? (store.get(key) as Record<string, unknown>) : undefined;
      return h && field in h ? (clone(h[field]) as T) : null;
    },
    async hgetall<T>(key: string) {
      return alive(key) ? (clone(store.get(key)) as Record<string, T>) : null;
    },
    async hset(key: string, values: Record<string, unknown>) {
      kv.writes++;
      const h = (alive(key) ? store.get(key) : {}) as Record<string, unknown>;
      store.set(key, { ...h, ...clone(values) });
    },
    async hdel(key: string, ...fields: string[]) {
      if (!alive(key)) return;
      const h = { ...(store.get(key) as Record<string, unknown>) };
      for (const f of fields) delete h[f];
      if (Object.keys(h).length) store.set(key, h);
      else store.delete(key);
    },
    async lpush(key: string, value: unknown) {
      kv.writes++;
      const l = (alive(key) ? store.get(key) : []) as unknown[];
      store.set(key, [clone(value), ...l]);
    },
    async ltrim(key: string, start: number, stop: number) {
      if (!alive(key)) return;
      store.set(key, (store.get(key) as unknown[]).slice(start, stop + 1));
    },
    async lrange<T>(key: string, start: number, stop: number) {
      if (!alive(key)) return [] as T[];
      const l = store.get(key) as T[];
      return clone(l.slice(start, stop < 0 ? l.length + stop + 1 : stop + 1));
    },
    async incr(key: string) {
      const n = (Number(alive(key) ? store.get(key) : 0) || 0) + 1;
      store.set(key, n);
      return n;
    },
  };
  return kv;
}

/** Krátky stabilný FNV-1a hash (bez Node-only závislostí). */
export function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/** Deterministický JSON (zoradené kľúče) — pre checksumy nezávislé od poradia polí. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",")}}`;
}
