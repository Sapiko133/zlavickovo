import { getDb } from "@/lib/db";
import { normalizeCurrencyCode, type SupportedCurrency } from "@/lib/price";
import { variantBaseKey } from "./variant-name";

type SqlClient = ReturnType<typeof getDb>;

export interface PriceDrop {
  productUrl: string;
  name: string;
  imgUrl: string;
  affiliateUrl: string | null;
  domain: string;
  oldPrice: number;   // najvyššia zaznamenaná cena v okne
  newPrice: number;   // posledná zaznamenaná cena
  dropPct: number;    // celé percento poklesu (napr. 27)
  currency: string;
}

// Ochrana pred falošnými poklesmi z rozbitého feedu (0 €, preklepy):
// akceptuj len poklesy v rozumnom rozsahu a s nenulovou cieľovou cenou.
const MIN_DROP_PCT = 5;
const MAX_DROP_PCT = 90;
const WINDOW_DAYS = 90;

/**
 * Najväčšie poklesy cien pre jednu doménu obchodu.
 *
 * Porovnáva poslednú zaznamenanú cenu produktu s jeho najvyššou cenou
 * v poslednom okne (WINDOW_DAYS). Vyžaduje ≥2 snapshoty na produkt —
 * kým sa product_price_history nenapĺňa (Vlna 2), vracia prázdne pole,
 * takže volajúca sekcia sa jednoducho nezobrazí.
 */
export async function getBiggestPriceDropsByDomain(
  domain: string,
  limit = 6
): Promise<PriceDrop[]> {
  if (!domain) return [];
  try {
    const sql = getDb();
    const rows = await sql`
      WITH latest AS (
        SELECT DISTINCT ON (product_url)
          product_url, price AS new_price, currency, domain
        FROM product_price_history
        WHERE domain = ${domain}
        ORDER BY product_url, recorded_at DESC
      ),
      peak AS (
        SELECT product_url, MAX(price) AS old_price
        FROM product_price_history
        WHERE domain = ${domain}
          AND recorded_at >= now() - (${WINDOW_DAYS} || ' days')::interval
        GROUP BY product_url
      )
      SELECT
        l.product_url                                       AS product_url,
        l.new_price::float8                                 AS new_price,
        p.old_price::float8                                 AS old_price,
        l.currency                                          AS currency,
        l.domain                                            AS domain,
        round((p.old_price - l.new_price) / p.old_price * 100)::int AS drop_pct,
        hp.name                                             AS name,
        hp.img_url                                          AS img_url,
        hp.affiliate_url                                    AS affiliate_url
      FROM latest l
      JOIN peak p ON p.product_url = l.product_url
      LEFT JOIN hk_products hp ON hp.url = l.product_url
      WHERE l.new_price > 0
        AND p.old_price > l.new_price
        AND round((p.old_price - l.new_price) / p.old_price * 100) BETWEEN ${MIN_DROP_PCT} AND ${MAX_DROP_PCT}
        AND hp.name IS NOT NULL
      ORDER BY (p.old_price - l.new_price) / p.old_price DESC
      LIMIT ${limit * 8}
    ` as any[];

    // Zlúč varianty toho istého produktu (najväčší pokles per produkt) a vezmi top N.
    const seen = new Set<string>();
    const drops: PriceDrop[] = [];
    for (const r of rows) {
      const key = variantBaseKey(r.name);
      if (seen.has(key)) continue;
      seen.add(key);
      drops.push({
        productUrl: r.product_url,
        name: r.name,
        imgUrl: r.img_url ?? "",
        affiliateUrl: r.affiliate_url ?? null,
        domain: r.domain,
        oldPrice: r.old_price,
        newPrice: r.new_price,
        dropPct: r.drop_pct,
        currency: r.currency ?? "EUR",
      });
      if (drops.length >= limit) break;
    }
    return drops;
  } catch (err) {
    // Chýbajúca tabuľka / prázdna história nesmie zhodiť stránku obchodu.
    console.error("[price-history] getBiggestPriceDropsByDomain:", err);
    return [];
  }
}

export interface PriceHistoryDailyRows {
  day: string;   // recorded_day (YYYY-MM-DD)
  rows: number;
}

export interface PriceHistoryStats {
  totalRows: number;
  distinctProducts: number;
  distinctDays: number;
  oldestRecordedAt: string | null;
  newestRecordedAt: string | null;
  latestRecordedDay: string | null;
  latestDayRows: number;
  rowsOlderThan120Days: number;
  // Približný rast: počet riadkov za posledných 7 recorded_day (vzostupne).
  last7Days: PriceHistoryDailyRows[];
}

// Rovnaká retenčná hranica ako v price-history-retention (monitoring meria backlog).
const RETENTION_DAYS = 120;

/**
 * Read-only agregovaná štatistika cenovej histórie pre admin monitoring.
 * Používa výhradne agregácie a existujúce indexy — NIKDY nenačíta riadky do
 * Node.js. Pri prázdnej tabuľke vracia nuly a null timestampy.
 */
export async function getPriceHistoryStats(
  sqlClient?: SqlClient
): Promise<PriceHistoryStats> {
  const sql = sqlClient ?? getDb();

  const [agg] = (await sql`
    SELECT
      count(*)::bigint                                          AS total_rows,
      count(DISTINCT product_url)::bigint                       AS distinct_products,
      count(DISTINCT recorded_day)::int                         AS distinct_days,
      min(recorded_at)                                          AS oldest_recorded_at,
      max(recorded_at)                                          AS newest_recorded_at,
      max(recorded_day)                                         AS latest_recorded_day,
      count(*) FILTER (
        WHERE recorded_day = (SELECT max(recorded_day) FROM product_price_history)
      )::bigint                                                 AS latest_day_rows,
      count(*) FILTER (
        WHERE recorded_at < now() - make_interval(days => ${RETENTION_DAYS}::int)
      )::bigint                                                 AS rows_older_than_retention
    FROM product_price_history
  `) as {
    total_rows: string | number;
    distinct_products: string | number;
    distinct_days: number;
    oldest_recorded_at: string | Date | null;
    newest_recorded_at: string | Date | null;
    latest_recorded_day: string | Date | null;
    latest_day_rows: string | number;
    rows_older_than_retention: string | number;
  }[];

  const daily = (await sql`
    SELECT recorded_day::text AS day, count(*)::int AS rows
    FROM product_price_history
    WHERE recorded_day >= (SELECT max(recorded_day) FROM product_price_history) - 6
    GROUP BY recorded_day
    ORDER BY recorded_day ASC
  `) as { day: string; rows: number }[];

  const toIso = (v: string | Date | null): string | null =>
    v === null ? null : v instanceof Date ? v.toISOString() : String(v);

  return {
    totalRows: Number(agg?.total_rows ?? 0),
    distinctProducts: Number(agg?.distinct_products ?? 0),
    distinctDays: Number(agg?.distinct_days ?? 0),
    oldestRecordedAt: toIso(agg?.oldest_recorded_at ?? null),
    newestRecordedAt: toIso(agg?.newest_recorded_at ?? null),
    latestRecordedDay: toIso(agg?.latest_recorded_day ?? null),
    latestDayRows: Number(agg?.latest_day_rows ?? 0),
    rowsOlderThan120Days: Number(agg?.rows_older_than_retention ?? 0),
    last7Days: daily.map((d) => ({ day: d.day, rows: Number(d.rows) })),
  };
}

export interface ProductPriceStats {
  current: number;
  min: number;
  max: number;
  // Celé percento poklesu od maxima v okne (0 ak je aktuálna cena = maximum).
  dropFromMaxPct: number;
  currency: SupportedCurrency;
}

/**
 * Cenová štatistika produktu pre produktový detail V1: aktuálna cena, minimum
 * a maximum v okne (WINDOW_DAYS) a pokles od maxima. Bez grafu a bez points[]
 * (V2). Kľúč je product_url (história jednej ponuky obchodu).
 *
 * Vracia null, kým nie sú ≥2 snapshoty, ak sa mena v okne mení (cross-currency
 * min/max by bolo klamlivé, §9) alebo ak cena nie je kladná — sekcia sa potom
 * jednoducho nezobrazí.
 */
export async function getProductPriceStats(
  productUrl: string,
  windowDays = WINDOW_DAYS,
  sqlClient?: SqlClient
): Promise<ProductPriceStats | null> {
  if (!productUrl) return null;
  try {
    const sql = sqlClient ?? getDb();
    const rows = (await sql`
      WITH h AS (
        SELECT price, currency, recorded_at
        FROM product_price_history
        WHERE product_url = ${productUrl}
          AND recorded_at >= now() - (${windowDays} || ' days')::interval
      )
      SELECT
        count(*)::int                                          AS n,
        count(DISTINCT currency)::int                          AS currencies,
        min(price)::float8                                     AS min_price,
        max(price)::float8                                     AS max_price,
        (array_agg(price ORDER BY recorded_at DESC))[1]::float8 AS current_price,
        (array_agg(currency ORDER BY recorded_at DESC))[1]     AS currency
      FROM h
    `) as {
      n: number;
      currencies: number;
      min_price: number | null;
      max_price: number | null;
      current_price: number | null;
      currency: string | null;
    }[];

    const r = rows[0];
    if (!r || r.n < 2 || r.currencies !== 1) return null;

    const currency = normalizeCurrencyCode(r.currency);
    const max = r.max_price;
    const min = r.min_price;
    const current = r.current_price;
    if (!currency || max === null || min === null || current === null) return null;
    if (!(max > 0) || !(current > 0)) return null;

    return {
      current,
      min,
      max,
      dropFromMaxPct: Math.round(((max - current) / max) * 100),
      currency,
    };
  } catch (err) {
    console.error("[price-history] getProductPriceStats:", err);
    return null;
  }
}
