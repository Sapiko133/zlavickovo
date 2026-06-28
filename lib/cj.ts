import { redis } from "@/lib/redis";

export interface CjCoupon {
  id: string;
  advertiserId: string;
  advertiserName: string;
  code: string;
  description: string;
  startDate: string;
  endDate: string;
  link: string;
  discount: string;
  discountType: string;
  source: "cj";
}

export interface CjShop {
  advertiserId: string;
  advertiserName: string;
  affiliateLink: string;
  commission: string;
  source: "cj";
}

const COUPON_CACHE_KEY = "cj:coupons:v2";
const SHOP_CACHE_KEY = "cj:shops:v2";
const CACHE_TTL = 3600;

function xmlField(xml: string, tag: string): string {
  return xml.match(new RegExp(`<${tag}>(.*?)</${tag}>`))?.[1]?.trim() ?? "";
}

function parseLinks(xml: string): any[] {
  return [...xml.matchAll(/<link>([\s\S]*?)<\/link>/g)].map(m => m[1]);
}

async function fetchFromCj(params: Record<string, string>): Promise<string | null> {
  const apiKey = process.env.CJ_API_KEY;
  const websiteId = process.env.CJ_WEBSITE_ID;
  if (!apiKey || !websiteId) return null;

  const qs = new URLSearchParams({
    "website-id": websiteId,
    "link-type": "Text Link",
    "advertiser-ids": "joined",
    "records-per-page": "200",
    ...params,
  });

  try {
    const res = await fetch(
      `https://link-search.api.cj.com/v2/link-search?${qs}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(12000),
      }
    );
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}

async function fetchCjCoupons(): Promise<CjCoupon[]> {
  const xml = await fetchFromCj({ "promotion-type": "Coupon" });
  if (!xml) return [];

  const links = parseLinks(xml);
  const results: CjCoupon[] = [];
  const now = Date.now();

  for (const link of links) {
    const code = xmlField(link, "coupon-code");
    if (!code) continue;

    const endDateStr = xmlField(link, "promotion-end-date");
    if (endDateStr && new Date(endDateStr).getTime() < now) continue;

    results.push({
      id: `cj-${xmlField(link, "link-id")}`,
      advertiserId: xmlField(link, "advertiser-id"),
      advertiserName: xmlField(link, "advertiser-name"),
      code,
      description: xmlField(link, "link-name") || xmlField(link, "description"),
      startDate: xmlField(link, "promotion-start-date"),
      endDate: endDateStr,
      link: xmlField(link, "destination"),
      discount: xmlField(link, "sale-commission"),
      discountType: "percent",
      source: "cj",
    });
  }
  return results;
}

async function fetchCjShops(): Promise<CjShop[]> {
  const xml = await fetchFromCj({});
  if (!xml) return [];

  const links = parseLinks(xml);
  const seen = new Set<string>();
  const shops: CjShop[] = [];

  for (const link of links) {
    const id = xmlField(link, "advertiser-id");
    if (!id || seen.has(id)) continue;
    seen.add(id);
    shops.push({
      advertiserId: id,
      advertiserName: xmlField(link, "advertiser-name"),
      affiliateLink: xmlField(link, "destination"),
      commission: xmlField(link, "sale-commission"),
      source: "cj",
    });
  }
  return shops;
}

export async function getCjCoupons(): Promise<CjCoupon[]> {
  try {
    const cached = await redis.get<CjCoupon[]>(COUPON_CACHE_KEY);
    if (cached && Array.isArray(cached) && cached.length > 0) return cached;
  } catch {}

  const coupons = await fetchCjCoupons();
  if (coupons.length > 0) {
    try { await redis.set(COUPON_CACHE_KEY, coupons, { ex: CACHE_TTL }); } catch {}
  }
  return coupons;
}

export async function getCjShops(): Promise<CjShop[]> {
  try {
    const cached = await redis.get<CjShop[]>(SHOP_CACHE_KEY);
    if (cached && Array.isArray(cached) && cached.length > 0) return cached;
  } catch {}

  const shops = await fetchCjShops();
  if (shops.length > 0) {
    try { await redis.set(SHOP_CACHE_KEY, shops, { ex: CACHE_TTL }); } catch {}
  }
  return shops;
}

export async function getCjCouponsByShop(shopName: string): Promise<CjCoupon[]> {
  const all = await getCjCoupons();
  const lq = shopName.toLowerCase();
  return all.filter((c) => c.advertiserName.toLowerCase().includes(lq));
}

export async function importAndCacheCjCoupons(): Promise<number> {
  const coupons = await fetchCjCoupons();
  if (coupons.length > 0) {
    try { await redis.set(COUPON_CACHE_KEY, coupons, { ex: CACHE_TTL }); } catch {}
  }
  return coupons.length;
}
