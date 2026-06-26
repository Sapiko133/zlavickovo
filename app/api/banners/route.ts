import { getToken } from "@/lib/dognet";

const API_BASE = "https://api.app.dognet.com/api/v1";
const AD_CHANNEL_ID = 8875;

const cache = new Map<string, { data: any; ts: number }>();
const TTL = 3_600_000;

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const width = parseInt(url.searchParams.get("width") || "728");
  const height = parseInt(url.searchParams.get("height") || "90");
  const shop = url.searchParams.get("shop") || null;

  const cacheKey = `${width}x${height}:${shop || "all"}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < TTL) {
    return Response.json(cached.data);
  }

  try {
    const t = await getToken();
    const filterArr: any[] = [
      { width: { eq: width } },
      { height: { eq: height } },
    ];
    if (shop) filterArr.push({ campaign_name: { like: shop } });

    const res = await fetch(`${API_BASE}/banners/filter`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${t}`,
      },
      body: JSON.stringify({
        ad_channel_id: AD_CHANNEL_ID,
        filter: filterArr,
        "per-page": 20,
      }),
    });

    const data = await res.json();
    const banners: any[] = data.data || [];

    if (!banners.length) {
      cache.set(cacheKey, { data: null, ts: Date.now() });
      return Response.json(null);
    }

    const raw = banners[Math.floor(Math.random() * banners.length)];
    const banner = {
      image_url: raw.image_url || raw.banner_url || raw.url || null,
      click_url: raw.click_url || raw.redirect_url || raw.affiliate_link || "#",
      title: raw.title || raw.name || null,
    };

    cache.set(cacheKey, { data: banner.image_url ? banner : null, ts: Date.now() });
    return Response.json(banner.image_url ? banner : null, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200" },
    });
  } catch {
    return Response.json(null);
  }
}
