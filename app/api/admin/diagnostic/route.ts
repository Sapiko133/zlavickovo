import { getCoupons, getCouponsByShop } from "@/lib/dognet";
import { getEhubCoupons, getEhubShops } from "@/lib/ehub";
import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const source = searchParams.get("source");

  if (source === "ehub") {
    const [shops, coupons] = await Promise.all([
      getEhubShops().catch(() => []),
      getEhubCoupons().catch(() => []),
    ]);
    return Response.json({ shops: shops.length, coupons_count: coupons.length });
  }

  if (source === "recent") {
    try {
      const raw = await redis.lrange("recent_reveals", 0, 9);
      const reveals = raw.map((r: string) => { try { return JSON.parse(r); } catch { return null; } }).filter(Boolean);
      return Response.json({ reveals });
    } catch {
      return Response.json({ reveals: [] });
    }
  }

  // ?source=shop&slug=ejoytablety — debug getCouponsByShop
  if (source === "shop") {
    const slug = searchParams.get("slug") || "ejoytablety";
    const shopCoupons = await getCouponsByShop(slug).catch(() => []);
    const allCoupons = await getCoupons().catch(() => []);
    const dognetMatches = allCoupons.filter((c: any) => c.campaign?.name?.toLowerCase().includes(slug.toLowerCase()));
    return Response.json({
      slug,
      total: shopCoupons.length,
      dognet_total: allCoupons.length,
      dognet_matches: dognetMatches.length,
      sample_campaign_names: allCoupons.slice(0, 10).map((c: any) => c.campaign?.name),
      coupons: shopCoupons.slice(0, 5),
    });
  }

  // Default: Dognet
  const coupons = await getCoupons().catch(() => []);
  return Response.json({ total: coupons.length, coupons: coupons.slice(0, 5) });
}
