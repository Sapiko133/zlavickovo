import { getDb } from "@/lib/db";

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
