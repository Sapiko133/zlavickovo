import { getAffialCoupons } from "@/lib/affial";
import { getCjCouponsByShop } from "@/lib/cj";
import { redis } from "@/lib/redis";
import { getShopDomain } from "@/lib/shop-domains";
import { AFFIAL_COUPONS } from "@/lib/affial-coupons";
import { AFFIAL_SHOPS } from "@/lib/affial-shops";
import { normalizeShopSlug, normalizeShopName } from "@/lib/slug";

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
    signal: AbortSignal.timeout(8000),
  });
  
  const data = await res.json();
  token = data.token || data.data?.token;
  if (!token) throw new Error("Dognet login zlyhal");
  return token;
}

const COUPONS_CACHE_KEY = "dognet:coupons:v2";
const COUPONS_CACHE_TTL = 3600;

async function _fetchDognetCoupons(): Promise<any[]> {
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
    signal: AbortSignal.timeout(10000), // was 20000
  });
  const data = await res.json();
  return (data.data || []).map((c: any) => ({
    ...c,
    affiliate_link: c.url || c.affiliate_link || "#",
    title: c.title || c.description || c.detailed_description || (c.discount_value ? `${c.discount_value} zľava` : (c.campaign?.name || "Kupón")),
    name: c.name || c.title || c.description || "",
  }));
}

// Read-only: returns cached coupons or [] immediately. Cache is filled by /api/cron/refresh-affiliate-cache.
export async function getCoupons(): Promise<any[]> {
  try {
    const cached = await redis.get<any[]>(COUPONS_CACHE_KEY);
    if (cached && Array.isArray(cached) && cached.length > 0) return cached;
  } catch {}
  return [];
}

// Called only from the cron endpoint — allowed to be slow.
export async function refreshDognetCache(): Promise<{ count: number; error?: string }> {
  try {
    const coupons = await _fetchDognetCoupons();
    if (coupons.length > 0) {
      await redis.set(COUPONS_CACHE_KEY, coupons, { ex: COUPONS_CACHE_TTL });
    }
    return { count: coupons.length };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[dognet] refreshDognetCache zlyhalo:", msg);
    return { count: 0, error: msg };
  }
}

export async function getCouponsByShop(shopName: string) {
  const [dognetAll, affialAll, cjAll] = await Promise.all([
    getCoupons().catch(() => []),
    getAffialCoupons().catch(() => []),
    getCjCouponsByShop(shopName).catch(() => []),
  ]);

  const lower = shopName.toLowerCase();
  const shopSlug = normalizeShopSlug(shopName);
  const shopNorm = normalizeShopName(shopName);

  const dognet = dognetAll
    .filter((c: any) => {
      const camName = c.campaign?.name ?? "";
      // "Ejoytablety.cz" contains "ejoytablety"
      if (camName.toLowerCase().includes(lower)) return true;
      // Diacritics: normalizeShopSlug("Pôžičky.sk") === "pozicky"
      if (normalizeShopSlug(camName) === shopSlug) return true;
      // Strip all non-alphanumeric: "Ejoytablety.cz" → "ejoytablety" === "ejoytablety"
      if (normalizeShopName(camName) === shopNorm) return true;
      return false;
    })
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

  const affialShopMap = new Map(AFFIAL_SHOPS.map(s => [s.domain, s.affiliateUrl]));

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
    .map((c, i) => {
      const trackingUrl = affialShopMap.get(c.domain) ?? `https://${c.domain}`;
      return {
        id: `affial-static-${c.domain}-${i}`,
        title: `${c.discount} zľava`,
        name: `${c.discount} zľava`,
        code: c.code,
        type: 1 as const,
        affiliate_link: trackingUrl,
        url: trackingUrl,
        valid_to: c.expires !== "neomedzená" ? c.expires : null,
        campaign: { name: c.shop },
        campaign_name: c.shop,
        description: `Platný kód pre ${c.shop}${c.expires !== "neomedzená" ? ` – platí do ${c.expires}` : ""}`,
        source: "affial-static" as const,
      };
    });

  const seenCodes = new Set(
    [...dognet, ...cj, ...affialStatic].map((c: any) => c.code?.toUpperCase()).filter(Boolean)
  );
  const uniqueAffialXml = affialXml.filter(
    (c: any) => !c.code || !seenCodes.has(c.code.toUpperCase())
  );

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


export async function getShops() {
  try {
    const t = await getToken();

    // Use getCoupons() (cached) + campaigns endpoint in parallel — single source of truth
    const [couponsRes, cmpRes] = await Promise.allSettled([
      getCoupons(),
      fetch(`${API_BASE}/campaigns/filter`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${t}` },
        body: JSON.stringify({ "per-page": 200 }),
        signal: AbortSignal.timeout(20000),
      }).then(r => r.json()).catch(() => null),
    ]);

    // Build map from shops with active coupons (higher priority, have coupon count)
    const map = new Map<string, { id: number; name: string; count: number; logoUrl?: string }>();
    const coupons = couponsRes.status === "fulfilled" ? couponsRes.value : [];
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
      try { await redis.set(CACHE_KEY, deals, { ex: 3600 }); } catch {}
      return deals;
    }
  } catch {}

  // Fallback: AFFIAL_COUPONS that have a % discount
  const fallbackShopMap = new Map(AFFIAL_SHOPS.map(s => [s.domain, s.affiliateUrl]));
  const affialDeals: CarouselDeal[] = AFFIAL_COUPONS
    .filter(c => /\d+\s*%/.test(c.discount))
    .slice(0, limit)
    .map((c, i) => ({
      shop: c.shop,
      domain: c.domain,
      title: `${c.discount} zľava v ${c.shop}`,
      discount: c.discount,
      color: CAROUSEL_COLORS[i % CAROUSEL_COLORS.length],
      affiliateUrl: fallbackShopMap.get(c.domain) ?? `https://${c.domain}`,
    }));

  if (affialDeals.length >= 3) {
    try { await redis.set(CACHE_KEY, affialDeals, { ex: 3600 }); } catch {}
    return affialDeals;
  }

  return STATIC_CAROUSEL_DEALS;
}