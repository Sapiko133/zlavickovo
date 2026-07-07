/**
 * Logovanie outbound/affiliate klikov do Redis (existujúca Upstash infra).
 *
 * Cieľ: merať, čo reálne prináša kliky a potenciálny príjem — bez invazívneho
 * trackovania. Ukladá sa iba agregát počtov, nie profil používateľa.
 *
 * Model dát:
 *   Ploché all-time / denné počítadlá (presne podľa zadania):
 *     - click:outbound:all                    (INCR)  — všetky kliky spolu
 *     - click:outbound:daily:{YYYY-MM-DD}      (INCR)  — kliky za deň
 *     - click:outbound:shop:{slug}             (INCR)  — kliky na obchod (all-time)
 *     - click:outbound:type:{type}             (INCR)  — kliky podľa typu (all-time)
 *     - click:outbound:source:{source}         (INCR)  — kliky podľa source (all-time)
 *
 *   Denné ZSET buckety per dimenzia (pre okná 24h / 7d / 30d a top-N reporting):
 *     - click:o:d:shop:{day}    ZSET member=shopSlug
 *     - click:o:d:product:{day} ZSET member=productSlug
 *     - click:o:d:coupon:{day}  ZSET member=couponId|couponCode
 *     - click:o:d:type:{day}    ZSET member=type
 *     - click:o:d:source:{day}  ZSET member=source
 *   TTL 35 dní → pokrýva 30-dňové okno s rezervou, staré buckety miznú samé.
 *
 *   click:outbound:recent (LIST) — posledných 50 eventov (JSON) pre admin/audit
 *   náhľad „príkladov eventov". Capped, len na debug.
 *
 * Deduplikácia: rovnaký používateľ (IP+UA hash) + rovnaký target do 5 s = 1 klik.
 * SET NX EX 5. Pri chybe/read-only Redis radšej započítame, než by sme klik stratili.
 */
import { redis } from "@/lib/redis";
import { createHash } from "crypto";
import type { ClickType } from "@/lib/click-types";
import { CLICK_TYPES } from "@/lib/click-types";

const DAY_TTL_S = 35 * 24 * 60 * 60; // 35 dní kryje 30d okno s rezervou
const DEDUP_WINDOW_S = 5;            // rovnaký target v tomto okne = 1 klik
const RECENT_MAX = 50;

const ALL_KEY = "click:outbound:all";
const DEDUP_PREFIX = "click:outbound:dedup:";
const RECENT_KEY = "click:outbound:recent";

export interface ClickEvent {
  timestamp: number;
  source: string;
  type: ClickType;
  shopSlug: string | null;
  productSlug: string | null;
  couponId: string | null;
  couponCode: string | null;
  destinationDomain: string | null;
  query: string | null;
}

/** UTC deň: `2026-07-07`. */
function dayKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Kľúče posledných `days` dní (vrátane dneška). */
function windowDayKeys(days: number, now = Date.now()): string[] {
  const keys: string[] = [];
  for (let i = 0; i < days; i++) {
    keys.push(dayKey(new Date(now - i * 24 * 60 * 60 * 1000)));
  }
  return keys;
}

/** Neinvazívny hash návštevníka — IP + user-agent, nikdy neukladáme raw hodnoty. */
export function visitorHash(ip: string, ua: string): string {
  return createHash("sha256").update(`${ip}|${ua}`).digest("hex").slice(0, 16);
}

/** Doména z cieľovej URL (bez www) — pre destinationDomain, keď klient pošle len URL. */
export function domainFromUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Dedup identita klipu — čo považujeme za „ten istý target". */
function dedupKey(visitor: string, ev: ClickEvent): string {
  const target =
    ev.destinationDomain ||
    ev.couponCode ||
    ev.couponId ||
    ev.productSlug ||
    ev.shopSlug ||
    "_";
  const raw = `${visitor}|${ev.type}|${target}`;
  return DEDUP_PREFIX + createHash("sha256").update(raw).digest("hex").slice(0, 20);
}

/**
 * Zaznamenaj jeden outbound klik. Nikdy nevyhadzuje — tracking nesmie zhodiť
 * samotné presmerovanie. Vracia, či bol klik započítaný (false = dedup).
 */
export async function logOutboundClick(
  ev: ClickEvent,
  visitor: string
): Promise<{ counted: boolean }> {
  // Dedup: prvý klik v okne nastaví kľúč (NX), ďalšie identické NX neprejde.
  try {
    const fresh = await redis.set(dedupKey(visitor, ev), 1, {
      nx: true,
      ex: DEDUP_WINDOW_S,
    });
    if (fresh === null) return { counted: false };
  } catch {
    // ticho — radšej započítaj, než by sme klik stratili
  }

  const now = ev.timestamp || Date.now();
  const day = dayKey(new Date(now));
  const ops: Promise<unknown>[] = [];

  // Ploché počítadlá (zadanie)
  ops.push(redis.incr(ALL_KEY));
  ops.push(redis.incr(`click:outbound:daily:${day}`));
  ops.push(redis.incr(`click:outbound:type:${ev.type}`));
  ops.push(redis.incr(`click:outbound:source:${ev.source}`));
  if (ev.shopSlug) ops.push(redis.incr(`click:outbound:shop:${ev.shopSlug}`));

  // Denné ZSET buckety per dimenzia (windowed top-N)
  const zput = (dim: string, member: string) => {
    const key = `click:o:d:${dim}:${day}`;
    ops.push(redis.zincrby(key, 1, member));
    ops.push(redis.expire(key, DAY_TTL_S));
  };
  zput("type", ev.type);
  zput("source", ev.source);
  if (ev.shopSlug) zput("shop", ev.shopSlug);
  if (ev.productSlug) zput("product", ev.productSlug);
  const couponMember = ev.couponId || ev.couponCode;
  if (couponMember) zput("coupon", couponMember);

  // Denné počítadlo TTL + recent list (náhľad eventov)
  ops.push(redis.expire(`click:outbound:daily:${day}`, DAY_TTL_S));
  // Upstash client serializuje sám — ukladáme objekt priamo (nie JSON.stringify)
  ops.push(redis.lpush(RECENT_KEY, ev));
  ops.push(redis.ltrim(RECENT_KEY, 0, RECENT_MAX - 1));

  try {
    await Promise.all(ops);
  } catch {
    // ticho — pozri doc komentár
  }
  return { counted: true };
}

// ─────────────────────────── Reporting ───────────────────────────

export type ClickRow = { key: string; count: number };

/** ZUNION denných bucketov dimenzie cez okno → zoradený zoznam (top `limit`). */
async function topForWindow(
  dim: string,
  days: number,
  limit: number,
  now = Date.now()
): Promise<ClickRow[]> {
  const keys = windowDayKeys(days, now).map((d) => `click:o:d:${dim}:${d}`);
  let flat: unknown[] = [];
  try {
    flat = (await redis.zunion(keys.length, keys, {
      withScores: true,
      aggregate: "sum",
    })) as unknown[];
  } catch {
    return [];
  }
  const rows: ClickRow[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) {
    rows.push({ key: String(flat[i]), count: Number(flat[i + 1]) });
  }
  rows.sort((a, b) => b.count - a.count);
  return limit > 0 ? rows.slice(0, limit) : rows;
}

/** Súčet denných počítadiel klikov za okno. */
async function totalForWindow(days: number, now = Date.now()): Promise<number> {
  const keys = windowDayKeys(days, now).map((d) => `click:outbound:daily:${d}`);
  try {
    const vals = (await redis.mget<(number | null)[]>(...keys)) ?? [];
    return vals.reduce<number>((s, v) => s + (Number(v) || 0), 0);
  } catch {
    return 0;
  }
}

export interface ClickWindowStats {
  total: number;
  topShops: ClickRow[];
  topProducts: ClickRow[];
  topCoupons: ClickRow[];
  byType: ClickRow[];
  bySource: ClickRow[];
  heurekaFallback: number;
}

async function statsForWindow(days: number, now = Date.now()): Promise<ClickWindowStats> {
  const [total, topShops, topProducts, topCoupons, byType, bySource] = await Promise.all([
    totalForWindow(days, now),
    topForWindow("shop", days, 50, now),
    topForWindow("product", days, 50, now),
    topForWindow("coupon", days, 50, now),
    topForWindow("type", days, 0, now),
    topForWindow("source", days, 0, now),
  ]);
  const heurekaFallback = byType.find((r) => r.key === "heureka_fallback")?.count ?? 0;
  return { total, topShops, topProducts, topCoupons, byType, bySource, heurekaFallback };
}

/** Kompletný report klikov za okná (dni: 24h≈1d / 7d / 30d) + all-time total. */
export async function getClickStats(now = Date.now()): Promise<{
  generatedAt: number;
  allTimeTotal: number;
  windows: {
    last24h: ClickWindowStats;
    last7d: ClickWindowStats;
    last30d: ClickWindowStats;
  };
}> {
  let allTimeTotal = 0;
  try {
    allTimeTotal = Number(await redis.get<number>(ALL_KEY)) || 0;
  } catch {}
  const [last24h, last7d, last30d] = await Promise.all([
    statsForWindow(1, now),
    statsForWindow(7, now),
    statsForWindow(30, now),
  ]);
  return {
    generatedAt: now,
    allTimeTotal,
    windows: { last24h, last7d, last30d },
  };
}

/** Posledných N zalogovaných eventov (pre admin/audit náhľad). */
export async function getRecentClicks(limit = 20): Promise<ClickEvent[]> {
  try {
    const raw = (await redis.lrange<ClickEvent | string>(RECENT_KEY, 0, limit - 1)) ?? [];
    return raw
      .map((r) => {
        if (r && typeof r === "object") return r as ClickEvent;
        try { return JSON.parse(r as string) as ClickEvent; } catch { return null; }
      })
      .filter(Boolean) as ClickEvent[];
  } catch {
    return [];
  }
}

export { CLICK_TYPES };
