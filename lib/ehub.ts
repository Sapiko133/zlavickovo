import { redis } from "@/lib/redis";
import { createShopMatcher } from "@/lib/shop-match";

const BASE = "https://api.ehub.cz/v3";
const COUPONS_CACHE_KEY = "ehub:coupons:v1";
const COUPONS_CACHE_TTL = 86400;
const FETCH_TIMEOUT_MS = 10000;
// eHub API vracia max 100 poloziek na stranku (perPage limit 1-100, default 50).
const PER_PAGE = 100;
const MAX_PAGES = 50;

// Stiahne vsetky stranky daneho endpointu (vouchers/campaigns) po PER_PAGE polozkach.
async function _fetchAllPages(path: string, listKey: string): Promise<any[]> {
  const { partnerId, apiKey } = getCredentials();
  if (!partnerId || !apiKey) return [];
  const items: any[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await fetch(
      `${BASE}/publishers/${partnerId}/${path}?apiKey=${apiKey}&page=${page}&perPage=${PER_PAGE}`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      }
    );
    if (!res.ok) break;
    const data = await res.json();
    const batch: any[] = Array.isArray(data?.[listKey]) ? data[listKey] : [];
    items.push(...batch);
    const total = Number(data?.totalItems ?? 0);
    if (batch.length < PER_PAGE || (total > 0 && items.length >= total)) break;
  }
  return items;
}

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
  valid_from: string | null;
  valid_to: string | null;
  source: "ehub";
}

// Datumy su YYYY-MM-DD, staci string porovnanie.
function isDateRangeActive(validFrom: string | null | undefined, validTill: string | null | undefined): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (validFrom && String(validFrom).slice(0, 10) > today) return false;
  if (validTill && String(validTill).slice(0, 10) < today) return false;
  return true;
}

export interface EhubShop {
  id: string;
  name: string;
  web: string;
  logoUrl?: string;
  affiliateLink: string;
  commission: string;
  category: string;
}

async function _fetchEhubCoupons(): Promise<EhubCoupon[]> {
  const vouchers = await _fetchAllPages("vouchers", "vouchers");
  return vouchers
    .filter((v: any) => v.isValid === true && isDateRangeActive(v.validFrom, v.validTill))
    .map((v: any) => ({
      id: String(v.id ?? ""),
      title: String(v.name ?? v.title ?? ""),
      code: String(v.code ?? ""),
      description: String(v.description ?? ""),
      discount: String(v.value ?? ""),
      campaign_name: String(v.campaignName ?? ""),
      affiliate_link: String(v.url ?? v.link ?? "#"),
      valid_from: v.validFrom ?? null,
      valid_to: v.validTill ?? null,
      source: "ehub" as const,
    }));
}

// Read-only: returns cached coupons or [] immediately. Cache is filled by /api/cron/refresh-affiliate-cache.
// Datumovy filter sa aplikuje aj tu, aby 24h cache nezobrazovala medzicasom expirovane vouchery.
export async function getEhubCoupons(): Promise<EhubCoupon[]> {
  try {
    const cached = await redis.get<EhubCoupon[]>(COUPONS_CACHE_KEY);
    if (cached && Array.isArray(cached) && cached.length > 0) {
      return cached.filter(c => isDateRangeActive(c.valid_from, c.valid_to));
    }
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
  const matchesShop = createShopMatcher(shopName);
  return all.filter(c => matchesShop(c.campaign_name));
}

async function _fetchEhubShops(): Promise<EhubShop[]> {
  const campaigns = await _fetchAllPages("campaigns", "campaigns");
  return campaigns.map((c: any) => {
    const commission = c.commissionGroups?.[0]?.commissions?.[0];
    const commissionStr = commission
      ? `${commission.value}${commission.valueType === "%" ? "%" : " CZK"}`
      : "";
    return {
      id: String(c.id ?? ""),
      name: String(c.name ?? ""),
      web: String(c.web ?? ""),
      logoUrl: c.logoUrl || undefined,
      affiliateLink: String(c.defaultLink ?? "#"),
      commission: commissionStr,
      category: String(c.categories?.[0]?.name ?? ""),
    };
  });
}

const SHOPS_CACHE_KEY = "ehub:shops:v1";
const SHOPS_CACHE_TTL = 86400;

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
