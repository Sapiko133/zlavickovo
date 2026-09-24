import { getAffialCoupons } from "@/lib/affial";
import { getCjCoupons, type CjCoupon } from "@/lib/cj";
import { getEhubCoupons } from "@/lib/ehub";
import { redis } from "@/lib/redis";
import { getShopDomain } from "@/lib/shop-domains";
import { AFFIAL_COUPONS } from "@/lib/affial-coupons";
import { AFFIAL_SHOPS } from "@/lib/affial-shops";
import { STATIC_AKCIE, type AkciaType } from "@/lib/akcie";
import { createShopMatcher } from "@/lib/shop-match";
import { getAllManualCoupons, manualCouponsForShop, type ManualCoupon } from "@/lib/manual-coupons";
import { cleanDognetShopName } from "@/lib/shop-name";
import { isAllowedDognetCoupon, isDognetSkCzMarket } from "@/lib/dognet-market";
import { isOfferActive } from "@/lib/offers/freshness";
import { errorFromResponse, FeedError } from "@/lib/feeds/fetch";
import { feedVersionKey, readVersionedSnapshot } from "@/lib/feeds/engine";

const API_BASE = "https://api.app.dognet.com/api/v1";
const AD_CHANNEL_ID = 33415;

// Dognet click redirect. `chid` je konštanta nášho ad_channelu (33415) — rovnaká
// vo všetkých tracking urls, ktoré Dognet generuje. Zisťujeme ju z existujúcich
// voucher urls (self-healing), DEFAULT_CHID je fallback.
const DOGNET_REDIRECT_BASE = "https://go.dognet.com/";
const DEFAULT_CHID = "cl69TA2C";

/** Zostrojí Dognet tracking link z cieľovej URL — rovnaký formát, aký Dognet vracia v poli `url`. */
export function buildDognetTrackingUrl(chid: string, destUrl?: string | null): string | null {
  const dest = String(destUrl ?? "").trim();
  if (!chid || !dest.startsWith("http")) return null;
  return `${DOGNET_REDIRECT_BASE}?chid=${chid}&url=${encodeURIComponent(dest)}`;
}

/** chid z prvej voucher url, ktorá už tracking link má (fallback DEFAULT_CHID). */
function extractDognetChid(coupons: any[]): string {
  for (const c of coupons) {
    const u = typeof c?.url === "string" ? c.url : "";
    const m = u.match(/[?&]chid=([^&]+)/);
    if (m) return decodeURIComponent(m[1]);
  }
  return DEFAULT_CHID;
}

const TOKEN_CACHE_KEY = "dognet:token";
const TOKEN_CACHE_TTL = 82800; // 23 hodín

let token: string | null = null;

/** Zahodí cachovaný token (in-process aj Redis) — volá feed engine pri HTTP 401/403. */
export async function resetDognetToken(): Promise<boolean> {
  token = null;
  try { await redis.del(TOKEN_CACHE_KEY); } catch {}
  return Boolean(process.env.DOGNET_EMAIL && process.env.DOGNET_PASSWORD);
}

export async function getToken(): Promise<string> {
  if (token) return token;

  try {
    const cached = await redis.get<string>(TOKEN_CACHE_KEY);
    if (cached) {
      token = cached;
      return token;
    }
  } catch {}

  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: process.env.DOGNET_EMAIL,
      password: process.env.DOGNET_PASSWORD,
    }),
    signal: AbortSignal.timeout(15000),
  });
  const httpErr = errorFromResponse(res, "Dognet login");
  if (httpErr) throw httpErr.kind === "http_4xx" ? new FeedError("auth", httpErr.message, { status: httpErr.status }) : httpErr;

  const data = await res.json();
  token = data.token || data.data?.token;
  if (!token) throw new FeedError("auth", "Dognet login zlyhal");

  try {
    await redis.set(TOKEN_CACHE_KEY, token, { ex: TOKEN_CACHE_TTL });
  } catch {}

  return token;
}

const COUPONS_CACHE_KEY = "dognet:coupons:v3"; // v3: market filter SK/CZ

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
    signal: AbortSignal.timeout(30000),
    cache: "no-store",
  });
  const httpErr = errorFromResponse(res, "Dognet coupons");
  if (httpErr) throw httpErr;
  const data = await res.json();
  if (!Array.isArray(data?.data)) throw new FeedError("validation", "Dognet coupons: odpoveď bez poľa data");
  const raw: any[] = data.data;
  const chid = extractDognetChid(raw);
  return raw.filter(isAllowedDognetCoupon).map((c: any) => {
    // Snapshot drží len polia, ktoré web používa. Kampaň z API nesie HTML popis,
    // account_metas a ad_channels (~1,7 KB/kupón) — zbytočný Redis prenos pri každom čítaní.
    const campaign = c.campaign
      ? {
          id: c.campaign.id,
          name: c.campaign.name ? cleanDognetShopName(c.campaign.name) : c.campaign.name,
          url: c.campaign.url,
          logo_url: c.campaign.logo_url,
        }
      : c.campaign;
    const { original_id: _o, form: _f, url_error: _ue, url_type: _ut, parallel_tracking: _pt, detailed_description, ...rest } = c;
    // c.url = Dognet tracking redirect. Welcome/klub/newsletter vouchery bez cieľovej URL
    // ho nemajú (url_error "Unable to generate URL without destination URL") — napr. Bonprix.
    // Filter je from_joined_campaigns, takže kampaň je joined → tracking link zostrojíme
    // z homepage kampane a nikdy nevrátime "#".
    const resolvedUrl = c.url || buildDognetTrackingUrl(chid, c.campaign?.url);
    return {
      ...rest,
      // detailed_description sa nečíta nikde okrem fallbacku popisu → zachovaj ho len tam
      description: c.description || detailed_description || null,
      campaign,
      url: resolvedUrl || c.url,
      affiliate_link: resolvedUrl || c.affiliate_link || "#",
      title: c.title || c.description || detailed_description || (c.discount_value ? `${c.discount_value} zľava` : (campaign?.name || "Kupón")),
      name: c.name || c.title || c.description || "",
    };
  });
}

/** Feed engine: striktný fetch kupónov (chyby vyhadzuje, nič nezapisuje). */
export async function fetchDognetCouponsStrict(): Promise<any[]> {
  return _fetchDognetCoupons();
}

// Read-only: returns cached coupons or [] immediately. Cache is filled by /api/cron/refresh-affiliate-cache.
// Market filter sa aplikuje aj pri čítaní, aby 24h cache nezobrazovala cudzie trhy.
// In-process memo (rovnaký vzor ako lib/cj.ts): cache ~560 KB sa obnovuje 1×/deň
// cronom, preto ju netreba ťahať z Redis pri každom requeste. Prázdny výsledok sa nememoizuje.
const COUPONS_MEMO_MS = 60_000;
let couponsMemo: { at: number; data: Promise<any[]> } | null = null;

export async function getCoupons(): Promise<any[]> {
  if (couponsMemo && Date.now() - couponsMemo.at < COUPONS_MEMO_MS) return couponsMemo.data;
  const data = (async () => {
    try {
      const cached = await readVersionedSnapshot<any[]>(COUPONS_CACHE_KEY, feedVersionKey("dognet-coupons"));
      if (cached && Array.isArray(cached) && cached.length > 0) {
        // Last-good snapshot môže byť pri výpadku siete starší — expirované kupóny
        // sa nesmú zobraziť ako aktuálne (kanonický freshness model).
        return cached.filter((c) => isAllowedDognetCoupon(c) && isOfferActive(c.valid_to ?? null));
      }
    } catch {}
    return [];
  })();
  couponsMemo = { at: Date.now(), data };
  data.then((d) => { if (d.length === 0) couponsMemo = null; }, () => { couponsMemo = null; });
  return data;
}

// Priamy fetch z Dognet API (bez cache) — pre prebuild, keď je Redis cache prázdna.
export async function fetchDognetCouponsDirect(): Promise<any[]> {
  return _fetchDognetCoupons();
}

// ── Joined kampane (aj bez voucherov) ───────────────────────────────────────
// Shop stránka obchodu, ktorý je joined (ad_channel status 1) ale nemá aktívny
// voucher, dostane affiliate link zostrojený z homepage kampane. Status 2/3
// (pending / nie joined) vynechávame — tam by tracking nekreditoval.
const CAMPAIGNS_CACHE_KEY = "dognet:joined-campaigns:v1"; // legacy fallback (pred feed engine)
/** Snapshot všetkých SK/CZ kampaní (slim) — plní feed engine (zdroj dognet-campaigns). */
export const DOGNET_CAMPAIGNS_SNAPSHOT_KEY = "dognet:campaigns:v2";

export interface DognetJoinedCampaign {
  name: string;
  url: string;
}

export interface DognetCampaignLite {
  id: number;
  name: string;
  url: string;
  logo_url?: string;
  /** Náš ad_channel je v kampani schválený (status 1). */
  joined: boolean;
}

/** SK/CZ kampane v slim tvare (bez HTML popisov) — striktné, chyby vyhadzuje. */
export async function fetchDognetCampaignsStrict(): Promise<DognetCampaignLite[]> {
  const t = await getToken();
  const all = await _fetchAllCampaigns(t, { strict: true });
  const out: DognetCampaignLite[] = [];
  for (const c of all) {
    if (!c?.name) continue;
    if (!isDognetSkCzMarket(c.name, c.url)) continue; // len SK/CZ trh
    const ch = (c.ad_channels_in_campaign || []).find((a: any) => a.ad_channel_id === AD_CHANNEL_ID);
    out.push({
      id: Number(c.id) || 0,
      name: cleanDognetShopName(c.name),
      url: String(c.url || ""),
      ...(c.logo_url ? { logo_url: String(c.logo_url) } : {}),
      joined: ch?.status === 1,
    });
  }
  return out;
}

async function getDognetCampaignsSnapshot(): Promise<DognetCampaignLite[] | null> {
  try {
    const cached = await readVersionedSnapshot<DognetCampaignLite[]>(
      DOGNET_CAMPAIGNS_SNAPSHOT_KEY,
      feedVersionKey("dognet-campaigns"),
      { memoMs: 10 * 60_000 },
    );
    return Array.isArray(cached) && cached.length > 0 ? cached : null;
  } catch {
    return null;
  }
}

export async function getJoinedDognetCampaigns(): Promise<DognetJoinedCampaign[]> {
  const snapshot = await getDognetCampaignsSnapshot();
  if (snapshot) {
    // len joined/approved s platnou URL — tam tracking kredituje
    return snapshot.filter((c) => c.joined && c.url.startsWith("http")).map((c) => ({ name: c.name, url: c.url }));
  }
  try {
    const cached = await redis.get<DognetJoinedCampaign[]>(CAMPAIGNS_CACHE_KEY);
    if (cached && Array.isArray(cached) && cached.length > 0) return cached;
  } catch {}
  return [];
}

// ── Coverage report (read-only audit) ──────────────────────────────────────
// Klasifikuje SK/CZ kampane podľa stavu nášho ad_channelu (33415):
//   status 1 = joined/approved; status 2/3 = pending; ad_channel chýba = joinovateľné
//   (= zoznam „o čo požiadať"). Používa /api/admin/affiliate-coverage.
export interface DognetCoverage {
  totalCampaigns: number;
  joined: DognetJoinedCampaign[];
  pending: DognetJoinedCampaign[];
  available: DognetJoinedCampaign[];
}

export async function getDognetCampaignCoverage(): Promise<DognetCoverage> {
  const t = await getToken();
  const all = await _fetchAllCampaigns(t);
  const joined: DognetJoinedCampaign[] = [];
  const pending: DognetJoinedCampaign[] = [];
  const available: DognetJoinedCampaign[] = [];
  for (const c of all) {
    if (!c.name) continue;
    if (!isDognetSkCzMarket(c.name, c.url)) continue; // len SK/CZ trh
    const entry: DognetJoinedCampaign = { name: cleanDognetShopName(c.name), url: c.url || "" };
    const ch = (c.ad_channels_in_campaign || []).find((a: any) => a.ad_channel_id === AD_CHANNEL_ID);
    if (!ch) available.push(entry);
    else if (ch.status === 1) joined.push(entry);
    else pending.push(entry);
  }
  const byName = (a: DognetJoinedCampaign, b: DognetJoinedCampaign) => a.name.localeCompare(b.name, "sk");
  return {
    totalCampaigns: all.length,
    joined: joined.sort(byName),
    pending: pending.sort(byName),
    available: available.sort(byName),
  };
}

/** chid nášho ad_channelu (z cached voucher urls). */
export async function getDognetChid(): Promise<string> {
  const coupons = await getCoupons().catch(() => []);
  return extractDognetChid(coupons);
}

/**
 * Affiliate URL obchodu z joined Dognet kampane — funguje aj pre kampane bez
 * voucherov. null keď obchod nie je joined (status 1) na SK/CZ trhu.
 */
export async function getShopDognetUrl(shopName: string): Promise<string | null> {
  const [campaigns, chid] = await Promise.all([getJoinedDognetCampaigns(), getDognetChid()]);
  if (campaigns.length === 0) return null;
  const matches = createShopMatcher(shopName);
  const hit = campaigns.find((c) => matches(c.name, c.url));
  return hit ? buildDognetTrackingUrl(chid, hit.url) : null;
}

// Akcia type → Dognet coupon type (labels in ShopCouponList: 1=Zľava, 2=Darček, 3=Výpredaj, 4=Iné, 5=Doprava zadarmo)
const AKCIA_TYPE_TO_COUPON_TYPE: Record<AkciaType, number> = {
  doprava: 5, vypredaj: 3, welcome: 1, gift: 2, event: 4,
};

/** Všetky zdroje kupónov/akcií načítané naraz — zdieľa ich stránka obchodu aj SEO index (sitemap). */
export interface ShopOfferSources {
  dognet: any[];
  affial: any[];
  ehub: Awaited<ReturnType<typeof getEhubCoupons>>;
  cj: CjCoupon[];
  manual: ManualCoupon[];
}

export async function loadShopOfferSources(): Promise<ShopOfferSources> {
  const [dognet, affial, ehub, cj, manual] = await Promise.all([
    getCoupons().catch(() => []),
    getAffialCoupons().catch(() => []),
    getEhubCoupons().catch(() => []),
    getCjCoupons().catch(() => []),
    getAllManualCoupons().catch(() => []),
  ]);
  return { dognet, affial, ehub, cj, manual };
}

export async function getCouponsByShop(shopName: string) {
  return collectShopOffers(shopName, await loadShopOfferSources());
}

/** Čistá (bez I/O) zostava ponúk obchodu z načítaných zdrojov. */
export function collectShopOffers(shopName: string, sources: ShopOfferSources) {
  const { dognet: dognetAll, affial: affialAll, ehub: ehubAll } = sources;

  // Slug/domain/normalized-name matching — "Alza.sk", "Alza", "alza.sk", "alza" → /kupony/alza
  const matchesShop = createShopMatcher(shopName);
  const cjAll = sources.cj.filter((c) => matchesShop(c.advertiserName));

  const dognet = dognetAll
    .filter((c: any) => matchesShop(c.campaign?.name, c.campaign?.url ?? c.campaign?.website_url))
    .map((c: any) => ({ ...c, source: "dognet" }));

  // Affial XML campaign_name is a domain ("zalando.sk") — match it as name AND domain
  const affialXml = affialAll.filter((c: any) =>
    matchesShop(c.campaign_name, c.campaign_name)
  );

  const ehub = ehubAll
    .filter((c) => matchesShop(c.campaign_name))
    .map((c) => ({
      id: `ehub-${c.id}`,
      code: c.code,
      title: c.title || c.description || `Kupón pre ${c.campaign_name}`,
      name: c.title,
      description: c.description,
      type: 1,
      affiliate_link: c.affiliate_link,
      url: c.affiliate_link,
      valid_to: c.valid_to,
      campaign: { name: c.campaign_name },
      campaign_name: c.campaign_name,
      source: "ehub" as const,
    }));

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

  // Static AFFIAL_COUPONS — match by shop name or domain
  const affialStatic = AFFIAL_COUPONS
    .filter(c => matchesShop(c.shop, c.domain))
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

  // STATIC_AKCIE (same source as /akcie page) — the shop's ongoing deals must show on its page too
  const staticAkcie = STATIC_AKCIE
    .filter(a => matchesShop(a.shopName, a.domain))
    .map(a => ({
      id: `akcia-${a.id}`,
      code: "",
      title: a.title,
      name: a.title,
      description: a.description,
      type: AKCIA_TYPE_TO_COUPON_TYPE[a.type] ?? 4,
      affiliate_link: a.affiliateUrl,
      url: a.affiliateUrl,
      valid_to: a.validTo ?? null,
      campaign: { name: a.shopName },
      campaign_name: a.shopName,
      source: "static-akcia" as const,
    }));

  // Manuálne kupóny z adminu (najvyššia priorita — zobrazujú sa vždy)
  const manual = manualCouponsForShop(shopName, sources.manual);

  const seenCodes = new Set(
    [...manual, ...dognet, ...cj, ...affialStatic].map((c: any) => c.code?.toUpperCase()).filter(Boolean)
  );
  const uniqueEhub = ehub.filter(
    (c: any) => !c.code || !seenCodes.has(c.code.toUpperCase())
  );
  for (const c of uniqueEhub) if (c.code) seenCodes.add(c.code.toUpperCase());
  const uniqueAffialXml = affialXml.filter(
    (c: any) => !c.code || !seenCodes.has(c.code.toUpperCase())
  );

  return [...manual, ...dognet, ...uniqueEhub, ...cj, ...uniqueAffialXml, ...affialStatic, ...staticAkcie];
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


// Dognet campaigns/filter má pagination (per-page max 200) — stiahni všetky strany.
const CAMPAIGNS_PER_PAGE = 200;
const CAMPAIGNS_MAX_PAGES = 10;

async function _fetchAllCampaigns(t: string, opts: { strict?: boolean } = {}): Promise<any[]> {
  const items: any[] = [];
  for (let page = 1; page <= CAMPAIGNS_MAX_PAGES; page++) {
    // Retry na 429/5xx — pri paralelnom cron refreshi Dognet občas rate-limituje
    // a bez retry by pagination skončila predčasne (neúplný campaigns cache).
    let res: Response | null = null;
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      res = await fetch(`${API_BASE}/campaigns/filter?page=${page}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${t}` },
        body: JSON.stringify({ "per-page": CAMPAIGNS_PER_PAGE }),
        signal: AbortSignal.timeout(20000),
        cache: "no-store",
      }).catch((e) => { lastError = e; return null; });
      if (res?.ok) break;
      if (res && (res.status === 401 || res.status === 403)) break; // auth — retry nepomôže
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    }
    if (!res?.ok) {
      // Striktný režim (feed engine): neúplná pagination = zlyhaný feed, NIE menší snapshot.
      if (opts.strict) {
        throw (res ? errorFromResponse(res, `Dognet campaigns page ${page}`) : null) ?? lastError ?? new FeedError("network", `Dognet campaigns page ${page}`);
      }
      break;
    }
    const data = await res.json();
    const batch: any[] = Array.isArray(data?.data) ? data.data : [];
    items.push(...batch);
    const lastPage = Number(data?._meta?.last_page ?? data?.meta?.last_page ?? 0);
    if (batch.length < CAMPAIGNS_PER_PAGE || (lastPage > 0 && page >= lastPage)) break;
  }
  return items;
}

export async function getShops(prefetchedCoupons?: any[]) {
  try {
    // Kampane zo snapshotu feed enginu; živé stránkovanie Dognet API len keď
    // snapshot ešte neexistuje (napr. prvý build) — nie pri každom rebuilde zoznamu.
    const [couponsRes, cmpRes] = await Promise.allSettled([
      prefetchedCoupons ? Promise.resolve(prefetchedCoupons) : getCoupons(),
      getDognetCampaignsSnapshot().then(async (snap) =>
        snap ?? (await _fetchAllCampaigns(await getToken()).catch(() => [] as any[]))),
    ]);

    // Build map from shops with active coupons (higher priority, have coupon count)
    const map = new Map<string, { id: number; name: string; count: number; logoUrl?: string; url?: string }>();
    const coupons = couponsRes.status === "fulfilled" ? couponsRes.value : [];
    for (const c of coupons) {
      const cam = c.campaign;
      if (!cam?.name) continue;
      if (!isAllowedDognetCoupon(c)) continue;
      const name = cleanDognetShopName(cam.name);
      const key = name.toLowerCase();
      const entry = map.get(key);
      if (entry) { entry.count++; }
      else { map.set(key, { id: cam.id ?? 0, name, count: 1, logoUrl: cam.logo_url, url: cam.url || undefined }); }
    }

    // Add all campaigns without coupons — len SK/CZ trhy (Variant A)
    if (cmpRes.status === "fulfilled" && Array.isArray(cmpRes.value)) {
      for (const c of cmpRes.value) {
        if (!c.name) continue;
        if (!isDognetSkCzMarket(c.name, c.url)) continue;
        const name = cleanDognetShopName(c.name);
        const key = name.toLowerCase();
        if (!map.has(key)) {
          map.set(key, { id: c.id ?? 0, name, count: 0, logoUrl: c.logo_url, url: c.url || undefined });
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
  const CACHE_KEY = "carousel:deals:v2"; // v2: Dognet market filter SK/CZ

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
