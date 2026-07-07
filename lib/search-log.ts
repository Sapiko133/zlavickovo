/**
 * Logovanie vyhľadávacích dopytov do Redis (existujúca Upstash infraštruktúra).
 *
 * Model dát:
 *   - hodinové buckety `search:log:h:{YYYY-MM-DD-HH}` (ZSET, ZINCRBY count) —
 *     umožňujú presné časové okná 24h / 7d / 30d cez ZUNION. TTL 32 dní, takže
 *     staré buckety miznú samé.
 *   - `search:log:all` (ZSET) — all-time agregát počtov.
 *   - `search:log:lastseen` (HASH) — timestamp posledného vyhľadania na dopyt.
 *
 * Ukladá sa VŽDY normalizovaný dopyt (lib/search-normalize.ts), takže "Káva",
 * "kava" a "  KAVA " zdieľajú jeden záznam. Žiadna analytika tretích strán.
 *
 * Deduplikácia: jeden používateľský search spustí naraz viacero API volaní
 * (stránka /hladat volá súčasne search-v2 aj feed-search pre ten istý dopyt,
 * plus React môže effect spustiť dvakrát). Krátke dedup okno (SET NX) zaručí,
 * že sa taký dopyt započíta iba raz — nie 2×/3× podľa počtu API volaní.
 */
import { redis } from "@/lib/redis";
import { normalizeSearchText } from "@/lib/search-normalize";

const HOUR_MS = 60 * 60 * 1000;
const BUCKET_TTL_S = 32 * 24 * 60 * 60; // 32 dní — kryje 30-dňové okno s rezervou
const DEDUP_WINDOW_S = 10; // to isté vyhľadanie v tomto okne = jeden započítaný dopyt

const ALL_KEY = "search:log:all";
const LASTSEEN_KEY = "search:log:lastseen";
const DEDUP_PREFIX = "search:log:dedup:";

/** Hodinový UTC bucket: `search:log:h:2026-07-07-14`. */
function bucketKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  return `search:log:h:${y}-${m}-${day}-${h}`;
}

/** Kľúče hodinových bucketov za posledných `hours` hodín (vrátane aktuálnej). */
function windowKeys(hours: number, now = Date.now()): string[] {
  const keys: string[] = [];
  for (let i = 0; i < hours; i++) keys.push(bucketKey(new Date(now - i * HOUR_MS)));
  return keys;
}

/**
 * Zaznamenaj jeden vyhľadávací dopyt. Nikdy nevyhadzuje — logovanie nesmie
 * zhodiť samotné vyhľadávanie (Redis môže byť read-only alebo nedostupný).
 */
export async function logSearchQuery(rawQuery: string): Promise<void> {
  const query = normalizeSearchText(rawQuery);
  if (!query) return;

  // Dedup: prvé volanie pre dopyt v okne nastaví kľúč (NX) a započíta sa;
  // ďalšie volania (súbežné search-v2 + feed-search, re-render, dvojklik) NX
  // neprejde → return bez započítania. Pri chybe/read-only Redis radšej
  // pokračujeme a započítame, než by sme dopyt stratili.
  try {
    const fresh = await redis.set(`${DEDUP_PREFIX}${query}`, 1, {
      nx: true,
      ex: DEDUP_WINDOW_S,
    });
    if (fresh === null) return; // v okne už zalogované
  } catch {
    // ticho — pokračuj na započítanie
  }

  const now = Date.now();
  const bucket = bucketKey(new Date(now));
  try {
    await Promise.all([
      redis.zincrby(bucket, 1, query),
      redis.zincrby(ALL_KEY, 1, query),
      redis.hset(LASTSEEN_KEY, { [query]: now }),
    ]);
    // TTL nastavujeme pri každom zápise (idempotentné) — bucket žije 32 dní od
    // posledného zápisu, čo je pre náš účel v poriadku.
    await redis.expire(bucket, BUCKET_TTL_S);
  } catch {
    // ticho — pozri doc komentár
  }
}

export type SearchStatRow = { query: string; count: number; lastSeen: number | null };

/** Definície časových okien pre reporting. */
export const SEARCH_WINDOWS = {
  h24: 24,
  d7: 7 * 24,
  d30: 30 * 24,
} as const;

/**
 * Zjednotí hodinové buckety okna a vráti top `limit` dopytov podľa počtu.
 * ZUNION s aggregate=sum + withScores vráti plochý zoznam [member, score, ...].
 */
async function topForWindow(hours: number, limit: number, now = Date.now()): Promise<SearchStatRow[]> {
  const keys = windowKeys(hours, now);
  let flat: unknown[] = [];
  try {
    flat = (await redis.zunion(keys.length, keys, {
      withScores: true,
      aggregate: "sum",
    })) as unknown[];
  } catch {
    return [];
  }

  const rows: { query: string; count: number }[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) {
    rows.push({ query: String(flat[i]), count: Number(flat[i + 1]) });
  }
  rows.sort((a, b) => b.count - a.count);
  const top = rows.slice(0, limit);
  const lastSeen = await getLastSeen(top.map((r) => r.query));
  return top.map((r) => ({ ...r, lastSeen: lastSeen[r.query] ?? null }));
}

/** Timestampy posledného vyhľadania pre zoznam dopytov (hmget). */
async function getLastSeen(queries: string[]): Promise<Record<string, number | null>> {
  if (queries.length === 0) return {};
  try {
    const raw = (await redis.hmget<Record<string, unknown>>(LASTSEEN_KEY, ...queries)) ?? {};
    const out: Record<string, number | null> = {};
    for (const q of queries) {
      const v = raw[q];
      out[q] = v == null ? null : Number(v);
    }
    return out;
  } catch {
    return {};
  }
}

/** Kompletný report: top `limit` (default 100) za 24h / 7d / 30d + all-time. */
export async function getSearchStats(limit = 100): Promise<{
  generatedAt: number;
  limit: number;
  windows: {
    last24h: SearchStatRow[];
    last7d: SearchStatRow[];
    last30d: SearchStatRow[];
  };
}> {
  const now = Date.now();
  const [last24h, last7d, last30d] = await Promise.all([
    topForWindow(SEARCH_WINDOWS.h24, limit, now),
    topForWindow(SEARCH_WINDOWS.d7, limit, now),
    topForWindow(SEARCH_WINDOWS.d30, limit, now),
  ]);
  return {
    generatedAt: now,
    limit,
    windows: { last24h, last7d, last30d },
  };
}
