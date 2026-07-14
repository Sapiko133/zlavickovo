import { redis } from "@/lib/redis";
import { createShopMatcher } from "@/lib/shop-match";

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

const COUPON_CACHE_KEY = "cj:coupons:v3";
const SHOP_CACHE_KEY = "cj:shops:v3";
const CACHE_TTL = 3600;
// Shopy/joined advertiseri sa menia pomaly — dlhší TTL drží joined cache teplú aj
// medzi dennými behmi refresh cronu. Bez toho vychladla za 1h a read-only
// cross-check pri Product Feed discovery vracal 503 (joinedAdvertisersUnavailable).
const SHOP_CACHE_TTL = 86400;

function xmlField(xml: string, tag: string): string {
  return xml.match(new RegExp(`<${tag}>(.*?)</${tag}>`))?.[1]?.trim() ?? "";
}

function parseLinks(xml: string): string[] {
  return [...xml.matchAll(/<link>([\s\S]*?)<\/link>/g)].map(m => m[1]);
}

// clickUrl = CJ tracking link (monetizovaný), destination = cieľová URL bez trackingu
function affiliateUrl(link: string): string {
  return xmlField(link, "clickUrl") || xmlField(link, "destination");
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
      link: affiliateUrl(link),
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
      affiliateLink: affiliateUrl(link),
      commission: xmlField(link, "sale-commission"),
      source: "cj",
    });
  }
  return shops;
}

// In-process memo — pri cache miss v Redis (napr. read-only token počas buildu)
// zdieľa jeden fetch medzi všetkými volaniami v rámci procesu
let couponsMemo: { at: number; data: Promise<CjCoupon[]> } | null = null;
let shopsMemo: { at: number; data: Promise<CjShop[]> } | null = null;

export async function getCjCoupons(): Promise<CjCoupon[]> {
  if (couponsMemo && Date.now() - couponsMemo.at < CACHE_TTL * 1000) {
    return couponsMemo.data;
  }
  const promise = (async () => {
    try {
      const cached = await redis.get<CjCoupon[]>(COUPON_CACHE_KEY);
      if (cached && Array.isArray(cached) && cached.length > 0) return cached;
    } catch {}

    const coupons = await fetchCjCoupons();
    if (coupons.length > 0) {
      try { await redis.set(COUPON_CACHE_KEY, coupons, { ex: CACHE_TTL }); } catch {}
    }
    return coupons;
  })();
  couponsMemo = { at: Date.now(), data: promise };
  promise.catch(() => { couponsMemo = null; });
  return promise;
}

export async function getCjShops(): Promise<CjShop[]> {
  if (shopsMemo && Date.now() - shopsMemo.at < CACHE_TTL * 1000) {
    return shopsMemo.data;
  }
  const promise = (async () => {
    try {
      const cached = await redis.get<CjShop[]>(SHOP_CACHE_KEY);
      if (cached && Array.isArray(cached) && cached.length > 0) return cached;
    } catch {}

    const shops = await fetchCjShops();
    if (shops.length > 0) {
      try { await redis.set(SHOP_CACHE_KEY, shops, { ex: SHOP_CACHE_TTL }); } catch {}
    }
    return shops;
  })();
  shopsMemo = { at: Date.now(), data: promise };
  promise.catch(() => { shopsMemo = null; });
  return promise;
}

export async function getCjCouponsByShop(shopName: string): Promise<CjCoupon[]> {
  const all = await getCjCoupons();
  const matches = createShopMatcher(shopName);
  return all.filter((c) => matches(c.advertiserName));
}

/**
 * Shop-level CJ affiliate link (napr. Answear.sk) — pre obchod, ktorý má v CJ
 * joined advertisera, ale žiadne coupon-type promo. Vráti CJ clickUrl (tracking).
 */
export async function getCjShopUrl(shopName: string): Promise<string | null> {
  const shops = await getCjShops().catch(() => [] as CjShop[]);
  const matches = createShopMatcher(shopName);
  const hit = shops.find((s) => matches(s.advertiserName, s.advertiserName) && s.affiliateLink?.startsWith("http"));
  return hit ? hit.affiliateLink : null;
}

/**
 * Výsledok read-only lookupu joined CJ advertiserov. Zámerne rozlišuje tri stavy,
 * aby volajúci nezamenil "žiadni joined" so "zdroj joinov nedostupný":
 *   - available: true, ids neprázdne  → úspešne načítaní joined advertiseri
 *   - available: true, ids prázdne    → cache existuje, ale reálne 0 joinov
 *   - available: false                → cache miss / Redis chyba (nedostupné)
 */
export type JoinedCjAdvertisers =
  | { available: true; ids: Set<string> }
  | { available: false };

/**
 * Read-only množina joined CJ advertiser ID z existujúcej shops cache.
 * Používa sa ako cross-check joined/active vzťahu pri Product Feed discovery
 * (Product Feed API sám relationship status nemusí poskytovať). NIKDY nezapisuje
 * do Redis (§27: discovery nesmie zapisovať).
 *
 * BEZPEČNOSŤ: pri cache miss alebo Redis chybe vráti { available: false }, NIE
 * prázdnu množinu — inak by discovery vyfiltroval všetko a vrátil falošný
 * ok=true, totalFeeds=0, hoci publisher má aktívnych CJ advertiserov. Prázdna
 * množina je vyhradená iba pre reálny stav "cache existuje, 0 joinov".
 */
export async function getJoinedCjAdvertiserIds(): Promise<JoinedCjAdvertisers> {
  try {
    const cached = await redis.get<CjShop[]>(SHOP_CACHE_KEY);
    if (Array.isArray(cached)) {
      return {
        available: true,
        ids: new Set(cached.map((s) => String(s.advertiserId)).filter(Boolean)),
      };
    }
    // cache miss (null/undefined) — nevieme rozlíšiť "0 joinov" od "cache nenaplnená"
    return { available: false };
  } catch {
    // Redis/cache/auth zlyhanie — nesmie vyzerať ako "0 joinov"
    return { available: false };
  }
}

export async function importAndCacheCjCoupons(): Promise<number> {
  const coupons = await fetchCjCoupons();
  if (coupons.length > 0) {
    try { await redis.set(COUPON_CACHE_KEY, coupons, { ex: CACHE_TTL }); } catch {}
  }
  return coupons.length;
}

/**
 * Deterministický warmer joined CJ shops cache — pre refresh-affiliate-cache cron.
 * Drží cj:shops:v3 teplú (24h TTL), aby read-only cross-check pri Product Feed
 * discovery ({@link getJoinedCjAdvertiserIds}) nevracal 503. Zapisuje iba pri
 * neprázdnom výsledku (nikdy neprepíše platnú cache prázdnou pri chybe CJ API).
 */
export async function refreshCjShopsCache(): Promise<{ count: number }> {
  const shops = await fetchCjShops();
  if (shops.length > 0) {
    try { await redis.set(SHOP_CACHE_KEY, shops, { ex: SHOP_CACHE_TTL }); } catch {}
  }
  return { count: shops.length };
}
