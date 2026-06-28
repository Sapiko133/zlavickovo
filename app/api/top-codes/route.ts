import { redis } from "@/lib/redis";
import { AFFIAL_COUPONS } from "@/lib/affial-coupons";

// Build real fallback from AFFIAL_COUPONS static array
function buildFallback() {
  return AFFIAL_COUPONS
    .filter(c => /\d+/.test(c.discount))
    .map(c => ({
      code: c.code,
      shop: c.shop.replace(/\.(sk|cz|com|eu|net)$/i, ""),
      discount: c.discount,
      clicks: 0,
      slug: c.domain.replace(/\.(sk|cz|eu|com|net)$/, "").replace(/\./g, "-"),
    }))
    .slice(0, 10);
}

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const shopFilter = url.searchParams.get("shop")?.toLowerCase() ?? null;

  try {
    const keys = await redis.keys("clicks:*");
    if (!keys.length) return Response.json(filterFallback(shopFilter));

    const counts = await Promise.all(keys.map(k => redis.get<number>(k)));

    const items = keys
      .map((key, i) => {
        const [, shop, code] = key.split(":");
        return { code: code.toUpperCase(), shop, discount: "", clicks: counts[i] ?? 0, slug: shop };
      })
      .filter(item => !shopFilter || item.shop === shopFilter)
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 10);

    return Response.json(items.length ? items : filterFallback(shopFilter), {
      headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" },
    });
  } catch {
    return Response.json(filterFallback(shopFilter));
  }
}

function filterFallback(shop: string | null) {
  const fallback = buildFallback();
  if (!shop) return fallback;
  const filtered = fallback.filter(f => f.shop.toLowerCase().includes(shop) || f.slug.includes(shop));
  return filtered;
}
