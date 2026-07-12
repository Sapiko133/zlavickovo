import { getDb } from "@/lib/db";
import { normalizeSearchText, searchMatchRank } from "@/lib/search-normalize";
import type { HkProduct, HkFeedRow } from "./types";
import { pickBestPurchase, type BestPurchase, type BestPurchaseCandidate } from "./best-purchase";
import { normalizeEan, normalizeManufacturer, normalizeProductNo, type IdentityLevel } from "./identity";
import { filterVariantConflicts } from "./variant";
import {
  formatAmount as formatCurrencyAmount,
  formatPricePrimary,
  getEurToCzkRate,
  getFormattedProductPricesFromRaw,
  inferCurrencyCodeForConfiguredFeed,
  normalizeCurrencyCode,
  parsePriceValue,
  type FormattedProductPrices,
  type SupportedCurrency,
} from "@/lib/price";

// Slug = {normalized-name}-{id}  →  /produkt/nike-air-max-90-12345
export function toProductSlug(name: string, id: number): string {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base}-${id}`;
}

// Extrahuj ID z konca slugu
export function idFromSlug(slug: string): number | null {
  const m = slug.match(/(\d+)$/);
  if (!m) return null;
  const id = parseInt(m[1], 10);
  return isNaN(id) ? null : id;
}

export async function getProductById(id: number): Promise<HkProduct | null> {
  try {
    const sql = getDb();
    const rows = await sql`SELECT * FROM hk_products WHERE id = ${id} LIMIT 1`;
    return (rows[0] as HkProduct) ?? null;
  } catch (err) {
    console.error("[heureka:db] getProductById:", err);
    return null;
  }
}

export async function getProducts(
  limit = 24,
  offset = 0,
  category?: string
): Promise<{ products: HkProduct[]; total: number }> {
  try {
    const sql = getDb();
    if (category) {
      const [rows, countRows] = await Promise.all([
        sql`SELECT id, name, price, currency_code, url, img_url, domain, category, affiliate_url, updated_at FROM hk_products WHERE category = ${category} ORDER BY updated_at DESC LIMIT ${limit} OFFSET ${offset}`,
        sql`SELECT COUNT(*)::int AS total FROM hk_products WHERE category = ${category}`,
      ]);
      return { products: rows as HkProduct[], total: (countRows[0] as any).total ?? 0 };
    }
    const [rows, countRows] = await Promise.all([
      sql`SELECT id, name, price, currency_code, url, img_url, domain, category, affiliate_url, updated_at FROM hk_products ORDER BY updated_at DESC LIMIT ${limit} OFFSET ${offset}`,
      sql`SELECT COUNT(*)::int AS total FROM hk_products`,
    ]);
    return { products: rows as HkProduct[], total: (countRows[0] as { total?: number }).total ?? 0 };
  } catch (err) {
    console.error("[heureka:db] getProducts:", err);
    return { products: [], total: 0 };
  }
}

/**
 * Produkty obchodu pre sekciu „Nakupované produkty z obchodu".
 * Výber: rozumné stredné cenové pásmo, nie najlacnejšie položky.
 * Extrémne lacné produkty filtrujeme preč (EUR/nejasné >= 3, CZK >= 80),
 * preferujeme produkty s obrázkom a potom cenu okolo stredu ponuky.
 */
export async function getShopProducts(domain: string, limit = 12): Promise<HkProduct[]> {
  if (!domain) return [];
  try {
    const sql = getDb();
    const rows = await sql`
      WITH priced AS (
        SELECT
          id, name, price, currency_code, url, img_url, domain, category, affiliate_url, updated_at,
          NULLIF(substring(replace(price, ',', '.') from '[0-9]+\\.?[0-9]*'), '')::numeric AS price_num
        FROM hk_products
        WHERE domain = ${domain}
      ),
      filtered AS (
        SELECT *,
          percent_rank() OVER (ORDER BY price_num) AS price_rank
        FROM priced
        WHERE price_num >= CASE WHEN currency_code = 'CZK' OR (currency_code IS NULL AND domain ~* '\\.cz$') THEN 80 ELSE 3 END
      )
      SELECT id, name, price, currency_code, url, img_url, domain, category, affiliate_url, updated_at
      FROM filtered
      ORDER BY
        CASE WHEN img_url <> '' THEN 0 ELSE 1 END,
        abs(price_rank - 0.55),
        updated_at DESC
      LIMIT ${limit}
    `;
    return rows as HkProduct[];
  } catch (err) {
    console.error("[heureka:db] getShopProducts:", err);
    return [];
  }
}

/**
 * Fallback produkty podľa kategórie obchodu — pre obchody bez vlastných produktov.
 * Výber: stredné cenové pásmo v kategórii, nie najlacnejšie položky
 * (rovnaký bezpečný price parse ako getShopProducts). Kategórie bez feedu
 * (elektronika, cestovanie) vrátia [] → volajúca stránka skúsi ďalší fallback.
 */
export async function getProductsByCategory(category: string, limit = 12): Promise<HkProduct[]> {
  if (!category) return [];
  try {
    const sql = getDb();
    const rows = await sql`
      WITH priced AS (
        SELECT
          id, name, price, currency_code, url, img_url, domain, category, affiliate_url, updated_at,
          NULLIF(substring(replace(price, ',', '.') from '[0-9]+\\.?[0-9]*'), '')::numeric AS price_num
        FROM hk_products
        WHERE category = ${category}
      ),
      filtered AS (
        SELECT *,
          percent_rank() OVER (ORDER BY price_num) AS price_rank
        FROM priced
        WHERE price_num >= CASE WHEN currency_code = 'CZK' OR (currency_code IS NULL AND domain ~* '\\.cz$') THEN 80 ELSE 3 END
      )
      SELECT id, name, price, currency_code, url, img_url, domain, category, affiliate_url, updated_at
      FROM filtered
      ORDER BY
        CASE WHEN img_url <> '' THEN 0 ELSE 1 END,
        abs(price_rank - 0.55),
        updated_at DESC
      LIMIT ${limit}
    `;
    return rows as HkProduct[];
  } catch (err) {
    console.error("[heureka:db] getProductsByCategory:", err);
    return [];
  }
}

export async function getProductsByDomain(domain: string, limit = 12): Promise<HkProduct[]> {
  try {
    const sql = getDb();
    const rows = await sql`
      SELECT id, name, price, currency_code, url, img_url, domain, category, affiliate_url, updated_at
      FROM hk_products WHERE domain = ${domain}
      ORDER BY updated_at DESC LIMIT ${limit}
    `;
    return rows as HkProduct[];
  } catch (err) {
    console.error("[heureka:db] getProductsByDomain:", err);
    return [];
  }
}

// Heureka feedCategory je napr. "Zdraví a krása > Péče o tělo" — mapujeme na náš slug
export async function getProductsByHkCategory(
  hkCategorySlug: string,
  limit = 12
): Promise<HkProduct[]> {
  try {
    const sql = getDb();
    const rows = await sql`
      SELECT id, name, price, currency_code, url, img_url, domain, category, affiliate_url, updated_at
      FROM hk_products WHERE category = ${hkCategorySlug}
      ORDER BY updated_at DESC LIMIT ${limit}
    `;
    return rows as HkProduct[];
  } catch (err) {
    console.error("[heureka:db] getProductsByHkCategory:", err);
    return [];
  }
}

export async function getRelatedProducts(product: HkProduct, limit = 4): Promise<HkProduct[]> {
  try {
    const sql = getDb();
    const rows = await sql`
      SELECT id, name, price, currency_code, url, img_url, domain, category, affiliate_url, updated_at
      FROM hk_products
      WHERE domain = ${product.domain} AND id != ${product.id}
      ORDER BY updated_at DESC LIMIT ${limit}
    `;
    return rows as HkProduct[];
  } catch (err) {
    console.error("[heureka:db] getRelatedProducts:", err);
    return [];
  }
}

export type { BestPurchase, BestPurchaseOffer } from "./best-purchase";

/**
 * Ponuky toho istého produktu naprieč obchodmi + výber odporúčanej.
 * Identita produktu (PROJECT_VISION §8): validný EAN → validný
 * manufacturer+productno → presná zhoda názvu ako konzervatívny fallback.
 * Validáciu identít (GTIN checksum, placeholder EAN, productno "N/A"...)
 * robí lib/heureka/identity.ts — nevalidná identita sa NESMIE použiť na
 * spájanie produktov a prechádza sa na ďalší krok. Úrovne sa nemiešajú:
 * pri validnom EAN sa matchuje výhradne EAN-om, aby pár manufacturer+productno
 * s viacerými rôznymi EAN nespojil rozdielne varianty. Ranking (normalizácia
 * EUR/CZK, tie-breakery, vylúčenie neporovnateľných mien) žije
 * v pickBestPurchase (lib/heureka/best-purchase.ts).
 */
export async function getBestPurchase(product: HkProduct): Promise<BestPurchase | null> {
  try {
    const sql = getDb();
    const ean = normalizeEan(product.ean);
    const manufacturer = normalizeManufacturer(product.manufacturer);
    const productno = normalizeProductNo(product.productno);
    const identityLevel: IdentityLevel = ean
      ? "ean"
      : manufacturer && productno
        ? "manufacturer_productno"
        : "name";

    // Porovnanie na strane DB používa rovnakú normalizáciu ako identity.ts:
    // EAN bez medzier/pomlčiek, manufacturer lowercase + collapse whitespace,
    // productno collapse whitespace (case sa zachováva).
    const rows =
      identityLevel === "ean"
        ? await sql`
            SELECT id, name, price, currency_code, url, domain, affiliate_url, ean
            FROM hk_products
            WHERE id = ${product.id}
               OR translate(ean, ' -', '') = ${ean}
            LIMIT 80
          `
        : identityLevel === "manufacturer_productno"
          ? await sql`
              SELECT id, name, price, currency_code, url, domain, affiliate_url, ean
              FROM hk_products
              WHERE id = ${product.id}
                 OR (lower(regexp_replace(btrim(manufacturer), '\\s+', ' ', 'g')) = ${manufacturer}
                     AND regexp_replace(btrim(productno), '\\s+', ' ', 'g') = ${productno})
              LIMIT 80
            `
          : await sql`
              SELECT id, name, price, currency_code, url, domain, affiliate_url, ean
              FROM hk_products
              WHERE id = ${product.id}
                 OR lower(name) = lower(${product.name})
              LIMIT 80
            `;

    // Variant Guard (PROJECT_VISION §8): pri silnej identite (EAN,
    // manufacturer+productno) môžu kandidáti zdieľať identifikátor, no ísť
    // o iné balenie/množstvo (10 g vs 25×10 g). Také odfiltrujeme, aby
    // nevznikla falošná „Najvýhodnejšia kúpa". Pri name identite sa neaplikuje.
    // Odstránených kandidátov pripočítame do excludedCount, nech UI neuvádza
    // nepravdivý počet porovnaných ponúk.
    const { kept, excludedCount: variantExcluded } = filterVariantConflicts(
      { id: product.id, name: product.name },
      rows as BestPurchaseCandidate[],
      identityLevel !== "name"
    );

    const best = pickBestPurchase(kept, getEurToCzkRate(), identityLevel);
    if (best) best.excludedCount += variantExcluded;
    return best;
  } catch (err) {
    console.error("[heureka:db] getBestPurchase:", err);
    return null;
  }
}

// Diakritika na strane DB bez zmeny schémy/importu: search_vec obsahuje
// diakritické lexémy ('káva'), preto dopyt bez diakritiky ('kava') dorovnáme
// translate() fallbackom priamo v SELECTe. \m = začiatok slova (žiadne
// false positives typu "získavajte").
const SK_ACCENTED = "áäčďéěíĺľňóôöřŕšśťúůüýžź";
const SK_PLAIN = "aacdeeillnooorrsstuuuyzz";

export async function searchHkProducts(query: string, limit = 20): Promise<HkProduct[]> {
  if (!query.trim()) return [];
  try {
    const sql = getDb();
    const rows = await sql`
      SELECT *, ts_rank(search_vec, plainto_tsquery('simple', ${query})) AS rank
      FROM hk_products
      WHERE search_vec @@ plainto_tsquery('simple', ${query})
      ORDER BY rank DESC
      LIMIT ${limit}
    ` as HkProduct[];

    let merged: HkProduct[] = [...rows];
    if (merged.length < limit) {
      // Len [a-z0-9 ] — bezpečné pre regex (žiadne metaznaky z dopytu)
      const nq = normalizeSearchText(query).replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
      const cq = nq.replace(/ /g, "");
      if (nq) {
        try {
          const pattern = `\\m(${nq === cq ? nq : `${nq}|${cq}`})`;
          // Aj popis — tsquery vektor pokrýva name + description, fallback musí tiež
          const extra = await sql`
            SELECT id, name, description, price, currency_code, url, img_url, domain, category, affiliate_url, updated_at
            FROM hk_products
            WHERE translate(lower(name), ${SK_ACCENTED}, ${SK_PLAIN}) ~ ${pattern}
               OR translate(lower(coalesce(description, '')), ${SK_ACCENTED}, ${SK_PLAIN}) ~ ${pattern}
            LIMIT ${limit}
          ` as HkProduct[];
          const seen = new Set(merged.map(r => r.id));
          for (const r of extra) {
            if (!seen.has(r.id)) { merged.push(r); seen.add(r.id); }
          }
        } catch (err) {
          // Fallback nesmie zhodiť primárne tsquery výsledky
          console.error("[heureka:db] searchHkProducts fallback:", err);
        }
      }
    }

    // Relevancia: exact → startsWith → word boundary → substring (podľa názvu)
    merged.sort((a, b) => {
      const ra = searchMatchRank(a.name, query);
      const rb = searchMatchRank(b.name, query);
      return (ra < 0 ? 99 : ra) - (rb < 0 ? 99 : rb);
    });
    return merged.slice(0, limit);
  } catch (err) {
    console.error("[heureka:db] searchHkProducts:", err);
    return [];
  }
}

// Pre generateStaticParams v /produkt/[slug]
export async function getTopProductIds(limit = 100): Promise<{ id: number; name: string }[]> {
  try {
    const sql = getDb();
    const rows = await sql`SELECT id, name FROM hk_products ORDER BY id LIMIT ${limit}`;
    return rows as { id: number; name: string }[];
  } catch (err) {
    console.error("[heureka:db] getTopProductIds:", err);
    return [];
  }
}

// Počty produktov podľa kategórie — pre homepage "Obľúbené kategórie"
export async function getCategoryProductCounts(): Promise<Record<string, number>> {
  try {
    const sql = getDb();
    const rows = await sql`SELECT category, COUNT(*)::int AS count FROM hk_products GROUP BY category`;
    return Object.fromEntries((rows as { category: string; count: number }[]).map(r => [r.category, r.count]));
  } catch (err) {
    console.error("[heureka:db] getCategoryProductCounts:", err);
    return {};
  }
}

export async function getFeedStats(): Promise<HkFeedRow[]> {
  try {
    const sql = getDb();
    const rows = await sql`
      SELECT id, domain, category, currency_code, product_count, last_fetched_at, last_error, error_count, last_duration_ms
      FROM hk_feeds ORDER BY domain
    `;
    return rows as HkFeedRow[];
  } catch (err) {
    console.error("[heureka:db] getFeedStats:", err);
    return [];
  }
}

// Formátovanie cien — jediná implementácia žije v lib/price.ts. Zdroj pravdy pre menu
// je hk_products.currency_code; pre staré riadky (NULL) sa mena dovodí z textu ceny
// alebo z konfigurácie/domény kurátorovaného feedu. Neznáma mena → cena sa nezobrazí.
export { getFormattedProductPricesFromRaw, parsePriceValue };

export function currencyForDomain(domain?: string): SupportedCurrency {
  return inferCurrencyCodeForConfiguredFeed(domain) ?? "EUR";
}

export function formatAmount(n: number, currencyOrDomain?: string | null): string {
  const currency = normalizeCurrencyCode(currencyOrDomain) ?? inferCurrencyCodeForConfiguredFeed(currencyOrDomain) ?? "EUR";
  return formatCurrencyAmount(n, currency);
}

export function formatPrice(price: string, currencyOrDomain?: string | null): string {
  return formatPricePrimary(price, normalizeCurrencyCode(currencyOrDomain), currencyOrDomain);
}

export function formatProductPriceLines(product: Pick<HkProduct, "price" | "currency_code" | "domain">): FormattedProductPrices | null {
  return getFormattedProductPricesFromRaw(product.price, product.currency_code, product.domain);
}
