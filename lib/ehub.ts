import { redis } from "@/lib/redis";
import { createShopMatcher } from "@/lib/shop-match";

const BASE = "https://api.ehub.cz/v3";
const COUPONS_CACHE_KEY = "ehub:coupons:v3"; // v3: + approval filter (len schválené kampane)
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
  market: string;
  source: "ehub";
}

// Slovenské Zlavickovo zobrazuje len SK a CZ trhy.
const ALLOWED_MARKETS = new Set(["SK", "CZ"]);

// Market kampane: country z API (CZ/SK/other); pri "other" fallback na TLD domény webu.
export function getCampaignMarket(c: { country?: unknown; web?: unknown }): string {
  const country = String(c?.country ?? "").trim().toUpperCase();
  if (country && country !== "OTHER") return country;
  const web = String(c?.web ?? "").trim();
  if (web) {
    try {
      const host = new URL(web.includes("://") ? web : `https://${web}`).hostname;
      const tld = host.split(".").pop() ?? "";
      if (tld.length === 2) return tld.toUpperCase();
    } catch {}
  }
  return "OTHER";
}

export function isAllowedMarket(market: string | undefined): boolean {
  return market ? ALLOWED_MARKETS.has(market) : false;
}

/**
 * Schválenie publishera v kampani je v `commissionGroups[].status`.
 * Povolené = aspoň jedna skupina "approved"/"active"/"accepted".
 * Ostatné stavy (approval_required, pending, declined, bez statusu) znamenajú,
 * že publisher NIE je schválený → click.php?a_aid=… vráti 400
 * ("Publisher nie je povolený v kampani"). Preto takéto kampane nesmieme
 * zobrazovať ani z nich generovať affiliate linky.
 */
export function isApprovedCampaign(c: { commissionGroups?: unknown }): boolean {
  const groups = Array.isArray((c as any)?.commissionGroups) ? (c as any).commissionGroups : [];
  return groups.some((g: any) => /^(approved|active|accepted)$/i.test(String(g?.status ?? "")));
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
  market: string;
  approved: boolean;
}

async function _fetchEhubCoupons(): Promise<EhubCoupon[]> {
  const [vouchers, campaigns] = await Promise.all([
    _fetchAllPages("vouchers", "vouchers"),
    _fetchAllPages("campaigns", "campaigns"),
  ]);
  const marketByCampaignId = new Map<string, string>();
  const approvedCampaignIds = new Set<string>();
  for (const c of campaigns) {
    marketByCampaignId.set(String(c.id ?? ""), getCampaignMarket(c));
    if (isApprovedCampaign(c)) approvedCampaignIds.add(String(c.id ?? ""));
  }
  return vouchers
    .filter((v: any) => v.isValid === true && isDateRangeActive(v.validFrom, v.validTill))
    .filter((v: any) => isAllowedMarket(marketByCampaignId.get(String(v.campaignId ?? ""))))
    // len vouchery na kampaniach, kde je publisher schválený (inak by odkaz 400-oval)
    .filter((v: any) => approvedCampaignIds.has(String(v.campaignId ?? "")))
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
      market: marketByCampaignId.get(String(v.campaignId ?? "")) ?? "OTHER",
      source: "ehub" as const,
    }));
}

// Read-only: returns cached coupons or [] immediately. Cache is filled by /api/cron/refresh-affiliate-cache.
// Datumovy aj market filter sa aplikuje aj tu, aby 24h cache nezobrazovala expirovane
// vouchery ani vouchery z nerelevantnych trhov.
export async function getEhubCoupons(): Promise<EhubCoupon[]> {
  try {
    const cached = await redis.get<EhubCoupon[]>(COUPONS_CACHE_KEY);
    if (cached && Array.isArray(cached) && cached.length > 0) {
      return cached.filter(c => isDateRangeActive(c.valid_from, c.valid_to) && isAllowedMarket(c.market));
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
  return campaigns
    // len SK/CZ trh a len kampane, kde je publisher schválený — inak shop-level
    // defaultLink (click.php) vráti 400 "Publisher nie je povolený v kampani".
    .filter((c: any) => isAllowedMarket(getCampaignMarket(c)) && isApprovedCampaign(c))
    .map((c: any) => {
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
        market: getCampaignMarket(c),
        approved: true, // po filtri vyššie sú tu už len schválené kampane
      };
    });
}

// Priamy fetch z eHub API (bez cache) — pre prebuild, keď je Redis cache prázdna.
export async function fetchEhubShopsDirect(): Promise<EhubShop[]> {
  return _fetchEhubShops();
}

const SHOPS_CACHE_KEY = "ehub:shops:v3"; // v3: + approval filter (len schválené kampane)
const SHOPS_CACHE_TTL = 86400;

// Read-only: returns cached shops or [] immediately. Cache is filled by /api/cron/refresh-affiliate-cache.
// Market filter sa aplikuje aj pri citani, aby cache nezobrazovala nerelevantne trhy.
export async function getEhubShops(): Promise<EhubShop[]> {
  try {
    const cached = await redis.get<EhubShop[]>(SHOPS_CACHE_KEY);
    if (cached && Array.isArray(cached) && cached.length > 0) {
      // approved !== false = belt-and-suspenders proti starým/nechecknutým záznamom
      return cached.filter(s => isAllowedMarket(s.market) && s.approved !== false);
    }
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
