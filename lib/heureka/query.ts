import { getDb } from "@/lib/db";
import type { HkProduct, HkFeedRow } from "./types";

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
        sql`SELECT id, name, price, url, img_url, domain, category, affiliate_url, updated_at FROM hk_products WHERE category = ${category} ORDER BY updated_at DESC LIMIT ${limit} OFFSET ${offset}`,
        sql`SELECT COUNT(*)::int AS total FROM hk_products WHERE category = ${category}`,
      ]);
      return { products: rows as HkProduct[], total: (countRows[0] as any).total ?? 0 };
    }
    const [rows, countRows] = await Promise.all([
      sql`SELECT id, name, price, url, img_url, domain, category, affiliate_url, updated_at FROM hk_products ORDER BY updated_at DESC LIMIT ${limit} OFFSET ${offset}`,
      sql`SELECT COUNT(*)::int AS total FROM hk_products`,
    ]);
    return { products: rows as HkProduct[], total: (countRows[0] as any).total ?? 0 };
  } catch (err) {
    console.error("[heureka:db] getProducts:", err);
    return { products: [], total: 0 };
  }
}

export async function getProductsByDomain(domain: string, limit = 12): Promise<HkProduct[]> {
  try {
    const sql = getDb();
    const rows = await sql`
      SELECT id, name, price, url, img_url, domain, category, affiliate_url, updated_at
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
      SELECT id, name, price, url, img_url, domain, category, affiliate_url, updated_at
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
      SELECT id, name, price, url, img_url, domain, category, affiliate_url, updated_at
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
    `;
    return rows as HkProduct[];
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
      SELECT id, domain, category, product_count, last_fetched_at, last_error, error_count
      FROM hk_feeds ORDER BY domain
    `;
    return rows as HkFeedRow[];
  } catch (err) {
    console.error("[heureka:db] getFeedStats:", err);
    return [];
  }
}

// Feed ani DB nemajú pole meny — inferujeme z domény obchodu (.cz účtuje v CZK)
// Explicitné overridy pre známe české obchody s ne-CZ doménou
const CURRENCY_OVERRIDES: Record<string, "EUR" | "CZK"> = {
  "kojenecke-obleceni.eu": "CZK",
};

export function currencyForDomain(domain?: string): "EUR" | "CZK" {
  const d = (domain ?? "").trim().toLowerCase();
  if (CURRENCY_OVERRIDES[d]) return CURRENCY_OVERRIDES[d];
  return /\.cz$/i.test(d) ? "CZK" : "EUR";
}

export function formatAmount(n: number, domain?: string): string {
  const currency = currencyForDomain(domain);
  if (currency === "CZK") {
    return n.toLocaleString("cs-CZ", {
      style: "currency",
      currency: "CZK",
      minimumFractionDigits: 0,
      maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
    });
  }
  return n.toLocaleString("sk-SK", { style: "currency", currency: "EUR" });
}

export function formatPrice(price: string, domain?: string): string {
  if (!price) return "";
  const n = parseFloat(price.replace(/[^\d.,]/g, "").replace(",", "."));
  if (isNaN(n)) return price;
  return formatAmount(n, domain);
}
