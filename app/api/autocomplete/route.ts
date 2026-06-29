import { redis } from "@/lib/redis";
import { getShops as getDognetShops } from "@/lib/dognet";
import { getEhubShops } from "@/lib/ehub";
import { AFFIAL_SHOPS } from "@/lib/affial-shops";
import { normalizeShopSlug } from "@/lib/slug";
import { feedManager } from "@/lib/feeds/FeedManager";

export const dynamic = "force-dynamic";

const SHOPS_CACHE_KEY = "shops:all";
const SHOPS_CACHE_TTL = 86400; // 24 hours

interface ShopEntry {
  name: string;
  slug: string;
  category: string;
  domain: string;
}

interface ProductEntry {
  name: string;
  slug: string;
  category: string;
  domain: string;
  price?: string;
  url?: string;
}

function toDomain(web: string): string {
  try {
    const url = web.startsWith("http") ? web : `https://${web}`;
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return web.replace(/^www\./, "");
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode");
  const q = searchParams.get("q") || "";

  // ── Product search mode ──────────────────────────────────────
  if (mode === "product") {
    if (q.length < 1) return Response.json([]);
    try {
      const products = await feedManager.search(q);
      const results: ProductEntry[] = products.slice(0, 5).map(p => ({
        name: p.name,
        slug: "",
        category: p.category || "Produkt",
        domain: p.domain || "",
        price: p.price || "",
        url: p.affiliateUrl || p.url || "",
      }));
      return Response.json(results, {
        headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
      });
    } catch {
      return Response.json([]);
    }
  }

  // ── Shop search mode (default) ───────────────────────────────
  try {
    const cached = await redis.get<ShopEntry[]>(SHOPS_CACHE_KEY);
    if (cached && Array.isArray(cached) && cached.length > 0) {
      return Response.json(cached, {
        headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
      });
    }
  } catch {}

  const [dognetResult, ehubResult] = await Promise.allSettled([
    getDognetShops(),
    getEhubShops(),
  ]);

  const seen = new Set<string>();
  const result: ShopEntry[] = [];

  // Dognet shops (highest priority — have coupon counts)
  if (dognetResult.status === "fulfilled") {
    for (const shop of dognetResult.value) {
      if (!shop.name) continue;
      const slug = normalizeShopSlug(shop.name);
      if (seen.has(slug)) continue;
      seen.add(slug);
      result.push({ name: shop.name, slug, category: "Obchod", domain: "" });
    }
  }

  // eHub shops
  if (ehubResult.status === "fulfilled") {
    for (const shop of ehubResult.value) {
      if (!shop.name || !shop.web) continue;
      const slug = normalizeShopSlug(shop.name);
      if (seen.has(slug)) continue;
      seen.add(slug);
      result.push({
        name: shop.name,
        slug,
        category: shop.category || "Iné",
        domain: toDomain(shop.web),
      });
    }
  }

  // AFFIAL shops (static)
  for (const shop of AFFIAL_SHOPS) {
    const slug = normalizeShopSlug(shop.name);
    if (seen.has(slug)) continue;
    seen.add(slug);
    result.push({
      name: shop.name,
      slug,
      category: "Partnerský obchod",
      domain: shop.domain,
    });
  }

  if (result.length > 0) {
    try { await redis.set(SHOPS_CACHE_KEY, result, { ex: SHOPS_CACHE_TTL }); } catch {}
  }

  return Response.json(result, {
    headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
  });
}
