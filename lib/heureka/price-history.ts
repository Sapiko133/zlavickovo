import { getDb } from "@/lib/db";
import { normalizeCurrencyCode, type SupportedCurrency } from "@/lib/price";

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
      LIMIT ${limit}
    ` as any[];

    return rows.map((r) => ({
      productUrl: r.product_url,
      name: r.name,
      imgUrl: r.img_url ?? "",
      affiliateUrl: r.affiliate_url ?? null,
      domain: r.domain,
      oldPrice: r.old_price,
      newPrice: r.new_price,
      dropPct: r.drop_pct,
      currency: r.currency ?? "EUR",
    }));
  } catch (err) {
    // Chýbajúca tabuľka / prázdna história nesmie zhodiť stránku obchodu.
    console.error("[price-history] getBiggestPriceDropsByDomain:", err);
    return [];
  }
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
