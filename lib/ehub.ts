import { redis } from "@/lib/redis";

const BASE = "https://api.ehub.cz/v3";
const COUPONS_CACHE_KEY = "ehub:coupons:v1";
const COUPONS_CACHE_TTL = 3600;
const RENDER_TIMEOUT_MS = 5000;
const FETCH_TIMEOUT_MS = 10000;

function getCredentials() {
  return {
    partnerId: process.env.EHUB_PARTNER_ID ?? "",
    apiKey: process.env.EHUB_API_KEY ?? "",
  };
}

export interface EhubCoupon {
  id: string;
  title: string;
  code: string;
  description: string;
  discount: string;
  campaign_name: string;
  affiliate_link: string;
  valid_to: string | null;
  source: "ehub";
}

export interface EhubShop {
  id: string;
  name: string;
  web: string;
  logoUrl: string;
  affiliateLink: string;
  commission: string;
  category: string;
}

async function _fetchEhubCoupons(): Promise<EhubCoupon[]> {
  const { partnerId, apiKey } = getCredentials();
  if (!partnerId || !apiKey) return [];
  const res = await fetch(
    `${BASE}/publishers/${partnerId}/vouchers?apiKey=${apiKey}`,
    {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    }
  );
  if (!res.ok) return [];
  const data = await res.json();
  const vouchers: any[] = Array.isArray(data?.vouchers) ? data.vouchers : [];
  return vouchers.map((v: any) => ({
    id: String(v.id ?? ""),
    title: String(v.name ?? v.title ?? ""),
    code: String(v.code ?? ""),
    description: String(v.description ?? ""),
    discount: String(v.value ?? ""),
    campaign_name: String(v.campaignName ?? ""),
    affiliate_link: String(v.url ?? v.link ?? "#"),
    valid_to: v.validTill ?? null,
    source: "ehub" as const,
  }));
}

export async function getEhubCoupons(): Promise<EhubCoupon[]> {
  try {
    const cached = await redis.get<EhubCoupon[]>(COUPONS_CACHE_KEY);
    if (cached && Array.isArray(cached) && cached.length > 0) return cached;
  } catch {}

  const fetchAndCache = _fetchEhubCoupons()
    .then(async (coupons) => {
      if (coupons.length > 0) {
        try { await redis.setex(COUPONS_CACHE_KEY, COUPONS_CACHE_TTL, coupons); } catch {}
      }
      return coupons;
    })
    .catch((err: unknown) => {
      console.error("[ehub] getEhubCoupons zlyhalo:", err instanceof Error ? err.message : err);
      return [] as EhubCoupon[];
    });

  const renderDeadline = new Promise<EhubCoupon[]>((resolve) =>
    setTimeout(() => resolve([]), RENDER_TIMEOUT_MS)
  );

  return Promise.race([fetchAndCache, renderDeadline]);
}

export async function getEhubCouponsByShop(shopName: string): Promise<EhubCoupon[]> {
  const all = await getEhubCoupons();
  const lower = shopName.toLowerCase();
  return all.filter(c => c.campaign_name.toLowerCase().includes(lower));
}

async function _fetchEhubShops(): Promise<EhubShop[]> {
  const { partnerId, apiKey } = getCredentials();
  if (!partnerId || !apiKey) return [];
  const res = await fetch(
    `${BASE}/publishers/${partnerId}/campaigns?apiKey=${apiKey}`,
    {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    }
  );
  if (!res.ok) return [];
  const data = await res.json();
  const campaigns: any[] = Array.isArray(data?.campaigns) ? data.campaigns : [];
  return campaigns.map((c: any) => {
    const commission = c.commissionGroups?.[0]?.commissions?.[0];
    const commissionStr = commission
      ? `${commission.value}${commission.valueType === "%" ? "%" : " CZK"}`
      : "";
    return {
      id: String(c.id ?? ""),
      name: String(c.name ?? ""),
      web: String(c.web ?? ""),
      logoUrl: String(c.logoUrl ?? ""),
      affiliateLink: String(c.defaultLink ?? "#"),
      commission: commissionStr,
      category: String(c.categories?.[0]?.name ?? ""),
    };
  });
}

const SHOPS_CACHE_KEY = "ehub:shops:v1";
const SHOPS_CACHE_TTL = 7200;

export async function getEhubShops(): Promise<EhubShop[]> {
  try {
    const cached = await redis.get<EhubShop[]>(SHOPS_CACHE_KEY);
    if (cached && Array.isArray(cached) && cached.length > 0) return cached;
  } catch {}

  const fetchAndCache = _fetchEhubShops()
    .then(async (shops) => {
      if (shops.length > 0) {
        try { await redis.setex(SHOPS_CACHE_KEY, SHOPS_CACHE_TTL, shops); } catch {}
      }
      return shops;
    })
    .catch((err: unknown) => {
      console.error("[ehub] getEhubShops zlyhalo:", err instanceof Error ? err.message : err);
      return [] as EhubShop[];
    });

  const renderDeadline = new Promise<EhubShop[]>((resolve) =>
    setTimeout(() => resolve([]), RENDER_TIMEOUT_MS)
  );

  return Promise.race([fetchAndCache, renderDeadline]);
}
