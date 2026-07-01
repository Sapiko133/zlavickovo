import { redis } from "@/lib/redis";

const BASE = "https://api.ehub.cz/v3";
const COUPONS_CACHE_KEY = "ehub:coupons:v1";
const COUPONS_CACHE_TTL = 3600;
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

// Read-only: returns cached coupons or [] immediately. Cache is filled by /api/cron/refresh-affiliate-cache.
export async function getEhubCoupons(): Promise<EhubCoupon[]> {
  try {
    const cached = await redis.get<EhubCoupon[]>(COUPONS_CACHE_KEY);
    if (cached && Array.isArray(cached) && cached.length > 0) return cached;
  } catch {}
  return [];
}

// Called only from the cron endpoint — allowed to be slow.
export async function refreshEhubCache(): Promise<{ count: number; error?: string }> {
  try {
    const coupons = await _fetchEhubCoupons();
    if (coupons.length > 0) {
      await redis.set(COUPONS_CACHE_KEY, coupons, { ex: COUPONS_CACHE_TTL });
    }
    return { count: coupons.length };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ehub] refreshEhubCache zlyhalo:", msg);
    return { count: 0, error: msg };
  }
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

// Read-only: returns cached shops or [] immediately. Cache is filled by /api/cron/refresh-affiliate-cache.
export async function getEhubShops(): Promise<EhubShop[]> {
  try {
    const cached = await redis.get<EhubShop[]>(SHOPS_CACHE_KEY);
    if (cached && Array.isArray(cached) && cached.length > 0) return cached;
  } catch {}
  return [];
}

// Called only from the cron endpoint — allowed to be slow.
export async function refreshEhubShopsCache(): Promise<{ count: number; error?: string }> {
  try {
    const shops = await _fetchEhubShops();
    if (shops.length > 0) {
      await redis.set(SHOPS_CACHE_KEY, shops, { ex: SHOPS_CACHE_TTL });
    }
    return { count: shops.length };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ehub] refreshEhubShopsCache zlyhalo:", msg);
    return { count: 0, error: msg };
  }
}
