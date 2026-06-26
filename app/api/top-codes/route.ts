import { redis } from "@/lib/redis";

const FALLBACK = [
  { code: "ALZA20",    shop: "Alza",    discount: "20%",            clicks: 0, slug: "alza" },
  { code: "AFFILI30",  shop: "Shein",   discount: "30%",            clicks: 0, slug: "shein" },
  { code: "ZALA20SK",  shop: "Zalando", discount: "20%",            clicks: 0, slug: "zalando" },
  { code: "ALZAFREE",  shop: "Alza",    discount: "Doprava zadarmo",clicks: 0, slug: "alza" },
  { code: "ROHLIK10",  shop: "Rohlik",  discount: "10€",            clicks: 0, slug: "rohlik" },
];

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
  return shop ? FALLBACK.filter(f => f.shop.toLowerCase() === shop) : FALLBACK;
}
