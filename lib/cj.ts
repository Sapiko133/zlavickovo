import { redis } from "@/lib/redis";
import { createShopMatcher } from "@/lib/shop-match";
import {
  DAILY_REFRESH_CACHE_TTL_SECONDS,
  PROCESS_MEMO_TTL_SECONDS,
} from "@/lib/feeds/cache-policy";
import { errorFromResponse, FeedError } from "@/lib/feeds/fetch";
import { FEED_SNAPSHOT_TTL_SECONDS, feedVersionKey, readVersionedSnapshot } from "@/lib/feeds/engine";
import { isOfferActive } from "@/lib/offers/freshness";

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
const COUPON_CACHE_TTL = DAILY_REFRESH_CACHE_TTL_SECONDS;
// Shopy/joined advertiseri sa menia pomaly — dlhší TTL drží joined cache teplú aj
// medzi dennými behmi refresh cronu. Bez rezervy by read-only
// cross-check pri Product Feed discovery vracal 503 (joinedAdvertisersUnavailable).
const SHOP_CACHE_TTL = DAILY_REFRESH_CACHE_TTL_SECONDS;

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

function cjQuery(params: Record<string, string>): URLSearchParams | null {
  const apiKey = process.env.CJ_API_KEY;
  const websiteId = process.env.CJ_WEBSITE_ID;
  if (!apiKey || !websiteId) return null;
  return new URLSearchParams({
    "website-id": websiteId,
    "link-type": "Text Link",
    "advertiser-ids": "joined",
    "records-per-page": "200",
    ...params,
  });
}

/** Striktný CJ request — chyby vyhadzuje (feed engine ich klasifikuje a retryuje). */
async function fetchFromCjStrict(params: Record<string, string>, timeoutMs = 20000): Promise<string> {
  const qs = cjQuery(params);
  if (!qs) throw new FeedError("config", "CJ: chýba CJ_API_KEY alebo CJ_WEBSITE_ID");
  const res = await fetch(`https://link-search.api.cj.com/v2/link-search?${qs}`, {
    headers: { Authorization: `Bearer ${process.env.CJ_API_KEY}` },
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  const httpErr = errorFromResponse(res, "CJ link-search");
  if (httpErr) throw httpErr;
  const xml = await res.text();
  if (!/<links[\s>]/.test(xml)) throw new FeedError("parse", "CJ link-search: odpoveď bez <links>");
  return xml;
}

const CJ_MAX_PAGES = 5;

/** Všetky strany výsledku (records-per-page je max 200; kupónov býva viac). */
async function fetchCjLinksAllPages(params: Record<string, string>): Promise<string[]> {
  const links: string[] = [];
  for (let page = 1; page <= CJ_MAX_PAGES; page++) {
    const xml = await fetchFromCjStrict({ ...params, "page-number": String(page) });
    const batch = parseLinks(xml);
    links.push(...batch);
    const total = Number(xml.match(/total-matched="(\d+)"/)?.[1] ?? 0);
    const perPage = Number(params["records-per-page"] ?? 200);
    if (batch.length < perPage || (total > 0 && links.length >= total)) break;
  }
  return links;
}

async function fetchCjCoupons(): Promise<CjCoupon[]> {
  return fetchCjCouponsStrict().catch(() => []);
}

/** Feed engine: všetky strany coupon promo linkov; chyby vyhadzuje. */
export async function fetchCjCouponsStrict(): Promise<CjCoupon[]> {
  const links = await fetchCjLinksAllPages({ "promotion-type": "Coupon" });
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
  return fetchCjShopsStrict().catch(() => []);
}

/** Feed engine: joined advertiseri (shop-level linky); chyby vyhadzuje. */
export async function fetchCjShopsStrict(): Promise<CjShop[]> {
  const links = parseLinks(await fetchFromCjStrict({}));
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
  if (couponsMemo && Date.now() - couponsMemo.at < PROCESS_MEMO_TTL_SECONDS * 1000) {
    return couponsMemo.data;
  }
  const promise = (async () => {
    try {
      const cached = await readVersionedSnapshot<CjCoupon[]>(COUPON_CACHE_KEY, feedVersionKey("cj-coupons"));
      // Last-good snapshot môže byť pri výpadku starší — expirované kupóny vyraď.
      if (cached && Array.isArray(cached) && cached.length > 0) return cached.filter((c) => isOfferActive(c.endDate || null));
    } catch {}

    const coupons = await fetchCjCoupons();
    if (coupons.length > 0) {
      try { await redis.set(COUPON_CACHE_KEY, coupons, { ex: COUPON_CACHE_TTL }); } catch {}
    }
    return coupons;
  })();
  couponsMemo = { at: Date.now(), data: promise };
  promise.catch(() => { couponsMemo = null; });
  return promise;
}

export async function getCjShops(): Promise<CjShop[]> {
  if (shopsMemo && Date.now() - shopsMemo.at < PROCESS_MEMO_TTL_SECONDS * 1000) {
    return shopsMemo.data;
  }
  const promise = (async () => {
    try {
      const cached = await readVersionedSnapshot<CjShop[]>(SHOP_CACHE_KEY, feedVersionKey("cj-shops"), { memoMs: 10 * 60_000 });
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

// ── CJ banner kreatívy (reálne obrázky inzerenta, žiadna AI grafika) ──────────
export interface CjBanner {
  advertiserName: string;
  domain: string;
  imageUrl: string;
  area: number;
}

export const CJ_BANNER_CACHE_KEY = "cj:banners:v1";
const BANNER_CACHE_KEY = CJ_BANNER_CACHE_KEY;
let bannersMemo: { at: number; data: Promise<CjBanner[]> } | null = null;

function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function domainFromUrl(url: string): string {
  return (url.match(/^https?:\/\/(?:www\.)?([^/?#]+)/i)?.[1] || "").toLowerCase();
}

async function fetchCjBanners(): Promise<CjBanner[]> {
  return fetchCjBannersStrict().catch(() => []);
}

/** Feed engine: banner kreatívy joined advertiserov; chyby vyhadzuje. */
export async function fetchCjBannersStrict(): Promise<CjBanner[]> {
  // 500 bannerov = veľká XML odpoveď; CJ ju generuje pomaly (20 s nestačí).
  const xml = await fetchFromCjStrict({ "link-type": "Banner", "records-per-page": "500" }, 60000);
  const out: CjBanner[] = [];
  for (const link of parseLinks(xml)) {
    const html = decodeEntities(xmlField(link, "link-code-html"));
    const img = html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
    if (!img || !/^https?:\/\//.test(img)) continue;
    const w = Number(xmlField(link, "creative-width")) || 0;
    const h = Number(xmlField(link, "creative-height")) || 0;
    out.push({
      advertiserName: xmlField(link, "advertiser-name"),
      domain: domainFromUrl(xmlField(link, "destination")),
      imageUrl: img,
      area: w * h || 1,
    });
  }
  return out;
}

export async function getCjBanners(): Promise<CjBanner[]> {
  if (bannersMemo && Date.now() - bannersMemo.at < PROCESS_MEMO_TTL_SECONDS * 1000) {
    return bannersMemo.data;
  }
  const promise = (async () => {
    try {
      const cached = await redis.get<CjBanner[]>(BANNER_CACHE_KEY);
      if (cached && Array.isArray(cached) && cached.length > 0) return cached;
    } catch {}
    const banners = await fetchCjBanners();
    if (banners.length > 0) {
      try { await redis.set(BANNER_CACHE_KEY, banners, { ex: FEED_SNAPSHOT_TTL_SECONDS }); } catch {}
    }
    return banners;
  })();
  bannersMemo = { at: Date.now(), data: promise };
  promise.catch(() => { bannersMemo = null; });
  return promise;
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
