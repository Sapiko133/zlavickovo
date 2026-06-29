import { getAffialCoupons } from "@/lib/affial";
import { getCjCouponsByShop } from "@/lib/cj";
import { redis } from "@/lib/redis";
import { getShopDomain } from "@/lib/shop-domains";
import { AFFIAL_COUPONS } from "@/lib/affial-coupons";

const API_BASE = "https://api.app.dognet.com/api/v1";
const AD_CHANNEL_ID = 33415;

let token: string | null = null;

export async function getToken(): Promise<string> {
  if (token) return token;
  
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: process.env.DOGNET_EMAIL,
      password: process.env.DOGNET_PASSWORD,
    }),
  });
  
  const data = await res.json();
  token = data.token || data.data?.token;
  if (!token) throw new Error("Dognet login zlyhal");
  return token;
}

export async function getCoupons() {
  const t = await getToken();
  
  const res = await fetch(`${API_BASE}/coupons/filter`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${t}`,
    },
    body: JSON.stringify({
      ad_channel_id: AD_CHANNEL_ID,
      from_joined_campaigns: true,
      filter: [{ validity: { eq: "present" } }],
      expand: "campaign",
      "per-page": 500,
    }),
  });
  
  const data = await res.json();
  return data.data || [];
}

export async function getCouponsByShop(shopName: string) {
  const [dognetAll, affialAll, cjAll] = await Promise.all([
    getCoupons().catch(() => []),
    getAffialCoupons().catch(() => []),
    getCjCouponsByShop(shopName).catch(() => []),
  ]);
  const lower = shopName.toLowerCase();

  const dognet = dognetAll
    .filter((c: any) => c.campaign?.name?.toLowerCase().includes(lower))
    .map((c: any) => ({ ...c, source: "dognet" }));

  const affialXml = affialAll.filter((c: any) =>
    c.campaign_name?.toLowerCase().includes(lower)
  );

  const cj = cjAll.map((c: any) => ({
    id: c.id,
    code: c.code,
    title: c.description,
    name: c.description,
    type: 1,
    affiliate_link: c.link,
    url: c.link,
    valid_to: c.endDate || null,
    campaign: { name: c.advertiserName },
    campaign_name: c.advertiserName,
    source: "cj",
  }));

  // Static AFFIAL_COUPONS — match by shop name or domain base
  const affialStatic = AFFIAL_COUPONS
    .filter(c => {
      const domainBase = c.domain.replace(/\.(sk|cz|eu|com|net|org)$/, "").replace(/\./g, "-");
      return (
        c.shop.toLowerCase().includes(lower) ||
        c.domain.toLowerCase().includes(lower) ||
        domainBase.toLowerCase() === lower
      );
    })
    .map((c, i) => ({
      id: `affial-static-${c.domain}-${i}`,
      title: `${c.discount} zľava`,
      name: `${c.discount} zľava`,
      code: c.code,
      type: 1 as const,
      affiliate_link: `https://${c.domain}`,
      url: `https://${c.domain}`,
      valid_to: c.expires !== "neomedzená" ? c.expires : null,
      campaign: { name: c.shop },
      campaign_name: c.shop,
      description: `Platný kód pre ${c.shop}${c.expires !== "neomedzená" ? ` – platí do ${c.expires}` : ""}`,
      source: "affial-static" as const,
    }));

  const seenCodes = new Set(
    [...dognet, ...cj, ...affialStatic].map((c: any) => c.code?.toUpperCase()).filter(Boolean)
  );
  const uniqueAffialXml = affialXml.filter(
    (c: any) => !c.code || !seenCodes.has(c.code.toUpperCase())
  );

  console.log(`[getCouponsByShop] "${shopName}": dognet=${dognet.length} affialXml=${uniqueAffialXml.length} cj=${cj.length} affialStatic=${affialStatic.length}`);

  return [...dognet, ...cj, ...uniqueAffialXml, ...affialStatic];
}

export async function getLatestCoupons(limit = 6) {
  const all = await getCoupons();
  return all
    .filter((c: any) => c.code)
    .slice(0, limit);
}

// Type 1 = Zľava, Type 3 = Výpredaj — for homepage feeds
export async function getCouponsFeed(limit = 12) {
  const all = await getCoupons();
  return all.slice(0, limit);
}

export async function getSalesCoupons(limit = 6) {
  const all = await getCoupons();
  return all
    .filter((c: any) => c.type === 3 || c.type === 1)
    .slice(0, limit);
}

export async function getLatestSales(limit = 8) {
  const all = await getCoupons();
  return all
    .filter((c: any) => c.type === 3)
    .sort((a: any, b: any) => {
      const da = new Date(a.valid_from || 0).getTime();
      const db = new Date(b.valid_from || 0).getTime();
      return db - da;
    })
    .slice(0, limit);
}


async function getCouponsForChannel(channelId: number) {
  try {
    const t = await getToken();
    const res = await fetch(`${API_BASE}/coupons/filter`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${t}` },
      body: JSON.stringify({
        ad_channel_id: channelId,
        from_joined_campaigns: true,
        filter: [{ validity: { eq: "present" } }],
        expand: "campaign",
        "per-page": 500,
      }),
    });
    const data = await res.json();
    return data.data || [];
  } catch {
    return [];
  }
}

export async function getShops() {
  try {
    const t = await getToken();

    // Run coupon channel + campaigns endpoint in parallel
    const [ch1, cmpRes] = await Promise.allSettled([
      getCouponsForChannel(33415),
      fetch(`${API_BASE}/campaigns/filter`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${t}` },
        body: JSON.stringify({ "per-page": 200 }),
      }).then(r => r.json()).catch(() => null),
    ]);

    // Build map from shops with active coupons (higher priority, have coupon count)
    const map = new Map<string, { id: number; name: string; count: number; logoUrl?: string }>();
    const coupons = ch1.status === "fulfilled" ? ch1.value : [];
    for (const c of coupons) {
      const cam = c.campaign;
      if (!cam?.name) continue;
      const key = cam.name.toLowerCase();
      const entry = map.get(key);
      if (entry) { entry.count++; }
      else { map.set(key, { id: cam.id ?? 0, name: cam.name, count: 1, logoUrl: cam.logo_url }); }
    }

    // Add all campaigns without coupons (fill remaining 200 slots)
    if (cmpRes.status === "fulfilled" && Array.isArray(cmpRes.value?.data)) {
      for (const c of cmpRes.value.data) {
        if (!c.name) continue;
        const key = c.name.toLowerCase();
        if (!map.has(key)) {
          map.set(key, { id: c.id ?? 0, name: c.name, count: 0, logoUrl: c.logo_url });
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  } catch {
    return [];
  }
}

export interface CarouselDeal {
  shop: string;
  domain: string;
  title: string;
  discount: string | null;
  color: string;
  affiliateUrl: string;
}

const CAROUSEL_COLORS = ["#0065BD", "#FF6900", "#8B1A1A", "#FF6B35", "#E31837", "#7C3AED", "#16A34A"];

const STATIC_CAROUSEL_DEALS: CarouselDeal[] = [
  { shop: "Alza",    domain: "alza.sk",    title: "Až 20% zľava na elektroniku",    discount: "20%", color: "#0065BD", affiliateUrl: "https://www.alza.sk" },
  { shop: "Zalando", domain: "zalando.sk", title: "Výpredaj módy až -50%",          discount: "50%", color: "#FF6900", affiliateUrl: "https://www.zalando.sk" },
  { shop: "Notino",  domain: "notino.sk",  title: "Parfémy so zľavou až 30%",       discount: "30%", color: "#8B1A1A", affiliateUrl: "https://www.notino.sk" },
  { shop: "GymBeam", domain: "gymbeam.sk", title: "Proteíny a doplnky -15%",        discount: "15%", color: "#FF6B35", affiliateUrl: "https://www.gymbeam.sk" },
  { shop: "Mall",    domain: "mall.sk",    title: "Domáce spotrebiče v akcii -25%", discount: "25%", color: "#E31837", affiliateUrl: "https://www.mall.sk" },
];

export async function getCarouselDeals(limit = 7): Promise<CarouselDeal[]> {
  const CACHE_KEY = "carousel:deals";

  try {
    const cached = await redis.get<CarouselDeal[]>(CACHE_KEY);
    if (cached && Array.isArray(cached) && cached.length > 0) return cached;
  } catch {}

  // Try Dognet: coupons with type 1 (Discount) or 3 (Sale) that have a % value
  try {
    const all = await getCoupons();
    const deals: CarouselDeal[] = all
      .filter((c: any) => {
        const text = (c.title || c.name || c.description || "");
        return (c.type === 1 || c.type === 3) && /\d+\s*%/.test(text);
      })
      .slice(0, limit)
      .map((c: any, i: number) => {
        const text = c.title || c.name || "";
        const m = text.match(/(\d+)\s*%/);
        const shopName: string = c.campaign?.name || "Obchod";
        const domain = getShopDomain(shopName) || "";
        return {
          shop: shopName,
          domain,
          title: text,
          discount: m ? `${m[1]}%` : null,
          color: CAROUSEL_COLORS[i % CAROUSEL_COLORS.length],
          affiliateUrl: c.affiliate_link || c.url || "#",
        } satisfies CarouselDeal;
      });

    if (deals.length >= 3) {
      try { await redis.setex(CACHE_KEY, 3600, deals); } catch {}
      return deals;
    }
  } catch {}

  // Fallback: AFFIAL_COUPONS that have a % discount
  const affialDeals: CarouselDeal[] = AFFIAL_COUPONS
    .filter(c => /\d+\s*%/.test(c.discount))
    .slice(0, limit)
    .map((c, i) => ({
      shop: c.shop,
      domain: c.domain,
      title: `${c.discount} zľava v ${c.shop}`,
      discount: c.discount,
      color: CAROUSEL_COLORS[i % CAROUSEL_COLORS.length],
      affiliateUrl: `https://${c.domain}`,
    }));

  if (affialDeals.length >= 3) {
    try { await redis.setex(CACHE_KEY, 3600, affialDeals); } catch {}
    return affialDeals;
  }

  return STATIC_CAROUSEL_DEALS;
}