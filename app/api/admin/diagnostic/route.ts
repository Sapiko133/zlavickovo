import { getCoupons, getCouponsByShop, getToken } from "@/lib/dognet";
import { getEhubCoupons, getEhubShops } from "@/lib/ehub";
import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const source = searchParams.get("source");

  // Diagnostika Dognet XML produktových feedov — prečo importDognetFeeds vracia 0
  if (source === "dognet-feeds") {
    const out: any = {};
    try {
      const token = await getToken();
      out.tokenLen = token.length;
      // Skús viac možných ciest — Dognet API sa mohlo premenovať
      const paths = ["/xml-feeds", "/feeds", "/product-feeds", "/xml_feeds"];
      out.endpoints = {};
      for (const p of paths) {
        try {
          const res = await fetch(`https://api.app.dognet.com/api/v1${p}`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(10000),
          });
          const text = await res.text();
          let shape = "";
          try {
            const j = JSON.parse(text);
            const arr = j.data ?? j.feeds ?? j;
            shape = Array.isArray(arr) ? `array[${arr.length}]` : `keys:${Object.keys(j).join(",")}`;
          } catch { shape = "non-json"; }
          out.endpoints[p] = { status: res.status, shape, sample: text.slice(0, 300) };
        } catch (e: any) {
          out.endpoints[p] = { error: e?.message ?? "fetch failed" };
        }
      }
    } catch (e: any) {
      out.error = e?.message ?? "token failed";
    }
    // Má kampaň feed/datafeed URL? (per-campaign auto-discovery)
    try {
      const token = await getToken();
      const res = await fetch("https://api.app.dognet.com/api/v1/campaigns/filter?page=1", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ "per-page": 3 }),
        signal: AbortSignal.timeout(12000),
      });
      const j = await res.json();
      const items = j.data ?? j ?? [];
      const first = Array.isArray(items) ? items[0] : items;
      out.campaign = {
        status: res.status,
        keys: first ? Object.keys(first) : [],
        feedLike: first
          ? Object.entries(first).filter(([k]) => /feed|xml|datafeed|export/i.test(k))
          : [],
      };
    } catch (e: any) {
      out.campaign = { error: e?.message ?? "failed" };
    }
    return Response.json(out);
  }

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

  // ?source=shop&slug=ejoytablety — debug getCouponsByShop (browser-visible)
  if (source === "shop") {
    const slug = searchParams.get("slug") || "ejoytablety";
    const allCoupons = await getCoupons().catch(() => []);
    const lower = slug.toLowerCase();

    // All unique campaign names from Dognet
    const campaignNames = [...new Set(allCoupons.map((c: any) => c.campaign?.name).filter(Boolean))] as string[];

    // Which ones match
    const matched = campaignNames.filter(n =>
      n.toLowerCase().includes(lower) || n.toLowerCase().replace(/\.(sk|cz|eu|com|net)$/i, "").replace(/\s+(sk|cz)/i, "").replace(/\s+/g, "-") === lower
    );

    const shopCoupons = await getCouponsByShop(slug).catch(() => []);

    return Response.json({
      slug,
      dognet_total_coupons: allCoupons.length,
      dognet_unique_campaigns: campaignNames.length,
      matched_campaigns: matched,
      result_coupons: shopCoupons.length,
      result_by_source: {
        dognet: shopCoupons.filter((c: any) => c.source === "dognet").length,
        cj: shopCoupons.filter((c: any) => c.source === "cj").length,
        affial_xml: shopCoupons.filter((c: any) => c.source === "affial").length,
        affial_static: shopCoupons.filter((c: any) => c.source === "affial-static").length,
      },
      // First 20 campaign names for manual inspection
      sample_campaigns: campaignNames.slice(0, 20),
    });
  }

  // Default: Dognet
  const coupons = await getCoupons().catch(() => []);
  return Response.json({ total: coupons.length, coupons: coupons.slice(0, 5) });
}
