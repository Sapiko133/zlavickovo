import { redis } from "@/lib/redis";
import { getShops as getDognetShops } from "@/lib/dognet";
import { getEhubShops } from "@/lib/ehub";
import { normalizeShopSlug } from "@/lib/slug";

export const dynamic = "force-dynamic";

const CACHE_KEY = "autocomplete:shops";
const CACHE_TTL = 3600;

interface ShopEntry {
  name: string;
  slug: string;
  category: string;
  domain: string;
}


function toDomain(web: string): string {
  try {
    const url = web.startsWith("http") ? web : `https://${web}`;
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return web.replace(/^www\./, "");
  }
}

export async function GET() {
  try {
    const cached = await redis.get<ShopEntry[]>(CACHE_KEY);
    if (cached && Array.isArray(cached) && cached.length > 0) {
      return Response.json(cached, {
        headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" },
      });
    }
  } catch {}

  const [dognetResult, ehubResult] = await Promise.allSettled([
    getDognetShops(),
    getEhubShops(),
  ]);

  const seen = new Set<string>();
  const result: ShopEntry[] = [];

  if (dognetResult.status === "fulfilled") {
    for (const shop of dognetResult.value) {
      if (!shop.name) continue;
      const slug = normalizeShopSlug(shop.name);
      if (seen.has(slug)) continue;
      seen.add(slug);
      result.push({ name: shop.name, slug, category: "Obchod", domain: "" });
    }
  }

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

  if (result.length > 0) {
    try { await redis.set(CACHE_KEY, result, { ex: CACHE_TTL }); } catch {}
  }

  return Response.json(result, {
    headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" },
  });
}
