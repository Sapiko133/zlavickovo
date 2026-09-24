/**
 * DISCOVER — register všetkých automatizovaných zdrojov feed enginu.
 *
 * Intervaly podľa reálnej volatility (merané 2026-09, produkčný Redis):
 *   HIGH   3 h (adaptívne až 12 h): Dognet kupóny (344, nové denne), eHub vouchery,
 *          Affial XML (podmienený GET — pri 304 takmer nulové náklady)
 *   MEDIUM 6 h (až 24 h): CJ kupóny (zahraniční advertiseri, menia sa pomalšie)
 *   LOW    24 h (až 48–72 h): zoznamy kampaní/obchodov a bannery
 * 15–30 min intervaly nemajú pri kupónových feedoch zmysel (siete ich aktualizujú
 * niekoľkokrát denne) a zbytočne by zaťažovali API providerov.
 *
 * Snapshot kľúče sú zhodné s pôvodnými cache kľúčmi → existujúci čitatelia
 * (stránky, SEO index, sitemap) fungujú bez zmeny.
 */
import { AFFIAL_SNAPSHOT_KEY, fetchAffialFeed, type AffialFeedCoupon } from "@/lib/affial";
import { CJ_BANNER_CACHE_KEY, fetchCjBannersStrict, fetchCjCouponsStrict, fetchCjShopsStrict, type CjBanner, type CjCoupon, type CjShop } from "@/lib/cj";
import {
  DOGNET_CAMPAIGNS_SNAPSHOT_KEY,
  fetchDognetCampaignsStrict,
  fetchDognetCouponsStrict,
  resetDognetToken,
  type DognetCampaignLite,
} from "@/lib/dognet";
import { fetchEhubCouponsStrict, fetchEhubShopsStrict, type EhubCoupon, type EhubShop } from "@/lib/ehub";
import { cleanFeedText } from "@/lib/offers/text";
import type { FeedSourceDef } from "./engine";

/** CJ vracia click linky na náhodnej z ekvivalentných domén — pre porovnanie stačí cesta. */
const cjStableLink = (u: string) => u.replace(/^https?:\/\/[^/]+/, "cj:");

const env = (...names: string[]) => () => names.every((n) => Boolean(process.env[n]));
const isHttp = (u: unknown) => typeof u === "string" && /^https?:\/\//.test(u);

/** Normalizácia textov (data quality) — bez zmeny identity a odkazov. */
function cleanFields<T extends object>(item: T, fields: (keyof T)[]): T {
  const out = { ...item };
  for (const f of fields) if (typeof out[f] === "string") out[f] = cleanFeedText(out[f]) as T[keyof T];
  return out;
}

/** Dognet kupón v tvare snapshotu (API objekt, zúžený v lib/dognet.ts). */
type DognetCoupon = { id?: unknown; title?: string; name?: string; description?: string; affiliate_link?: unknown; campaign?: { name?: string } };

const dognetCoupons: FeedSourceDef<DognetCoupon> = {
  id: "dognet-coupons",
  provider: "dognet",
  label: "Dognet – kupóny a akcie",
  url: "api.app.dognet.com/api/v1/coupons/filter (ad_channel 33415)",
  format: "json-api",
  tier: "high",
  baseIntervalMin: 180,
  maxIntervalMin: 720,
  snapshotKey: "dognet:coupons:v3",
  affects: ["coupons", "actions", "shops"],
  configured: env("DOGNET_EMAIL", "DOGNET_PASSWORD"),
  onAuthError: resetDognetToken,
  async fetch() {
    const items = await fetchDognetCouponsStrict();
    return { items: items.map((c) => cleanFields(c, ["title", "name", "description"])) };
  },
  itemKey: (c) => String(c?.id ?? ""),
  isValidItem: (c) => c?.id != null && Boolean(c?.campaign?.name) && typeof c?.affiliate_link === "string",
};

const dognetCampaigns: FeedSourceDef<DognetCampaignLite> = {
  id: "dognet-campaigns",
  provider: "dognet",
  label: "Dognet – kampane (SK/CZ)",
  url: "api.app.dognet.com/api/v1/campaigns/filter",
  format: "json-api",
  tier: "low",
  baseIntervalMin: 1440,
  maxIntervalMin: 2880,
  snapshotKey: DOGNET_CAMPAIGNS_SNAPSHOT_KEY,
  affects: ["shops"],
  configured: env("DOGNET_EMAIL", "DOGNET_PASSWORD"),
  onAuthError: resetDognetToken,
  fetch: async () => ({ items: await fetchDognetCampaignsStrict() }),
  itemKey: (c) => String(c.id || c.name),
  isValidItem: (c) => Boolean(c.name),
};

const ehubVouchers: FeedSourceDef<EhubCoupon> = {
  id: "ehub-vouchers",
  provider: "ehub",
  label: "eHub – vouchery",
  url: "api.ehub.cz/v3/publishers/{partner}/vouchers",
  format: "json-api",
  tier: "high",
  baseIntervalMin: 180,
  maxIntervalMin: 720,
  snapshotKey: "ehub:coupons:v3",
  affects: ["coupons", "actions"],
  configured: env("EHUB_API_KEY", "EHUB_PARTNER_ID"),
  minItemsForDropCheck: 10,
  async fetch() {
    const items = await fetchEhubCouponsStrict();
    return { items: items.map((c) => cleanFields(c, ["title", "description"])) };
  },
  itemKey: (c) => c.id,
  isValidItem: (c) => Boolean(c.id && c.campaign_name),
};

const ehubCampaigns: FeedSourceDef<EhubShop> = {
  id: "ehub-campaigns",
  provider: "ehub",
  label: "eHub – schválené kampane",
  url: "api.ehub.cz/v3/publishers/{partner}/campaigns",
  format: "json-api",
  tier: "low",
  baseIntervalMin: 1440,
  maxIntervalMin: 2880,
  snapshotKey: "ehub:shops:v3",
  affects: ["shops"],
  configured: env("EHUB_API_KEY", "EHUB_PARTNER_ID"),
  fetch: async () => ({ items: await fetchEhubShopsStrict() }),
  itemKey: (s) => s.id,
  isValidItem: (s) => Boolean(s.id && s.name),
};

const cjCoupons: FeedSourceDef<CjCoupon> = {
  id: "cj-coupons",
  provider: "cj",
  label: "CJ – kupóny",
  url: "link-search.api.cj.com/v2/link-search (promotion-type=Coupon)",
  format: "xml",
  tier: "medium",
  baseIntervalMin: 360,
  maxIntervalMin: 1440,
  snapshotKey: "cj:coupons:v3",
  affects: ["coupons", "actions"],
  configured: env("CJ_API_KEY", "CJ_WEBSITE_ID"),
  async fetch() {
    const items = await fetchCjCouponsStrict();
    return { items: items.map((c) => cleanFields(c, ["description", "advertiserName"])) };
  },
  itemKey: (c) => c.id,
  fingerprint: (c) => ({ ...c, link: cjStableLink(c.link) }),
  isValidItem: (c) => Boolean(c.id && c.advertiserName && isHttp(c.link)),
};

const cjShops: FeedSourceDef<CjShop> = {
  id: "cj-shops",
  provider: "cj",
  label: "CJ – joined advertiseri",
  url: "link-search.api.cj.com/v2/link-search (advertiser-ids=joined)",
  format: "xml",
  tier: "low",
  baseIntervalMin: 1440,
  maxIntervalMin: 2880,
  snapshotKey: "cj:shops:v3",
  affects: ["shops"],
  configured: env("CJ_API_KEY", "CJ_WEBSITE_ID"),
  minItemsForDropCheck: 10,
  fetch: async () => ({ items: await fetchCjShopsStrict() }),
  itemKey: (s) => s.advertiserId,
  // CJ vyberie pri každom requeste iný (rovnocenný) link inzerenta → link sa neporovnáva.
  fingerprint: (s) => ({ advertiserId: s.advertiserId, advertiserName: s.advertiserName, commission: s.commission }),
  isValidItem: (s) => Boolean(s.advertiserId && s.advertiserName),
};

const cjBanners: FeedSourceDef<CjBanner> = {
  id: "cj-banners",
  provider: "cj",
  label: "CJ – banner kreatívy",
  url: "link-search.api.cj.com/v2/link-search (link-type=Banner)",
  format: "xml",
  tier: "low",
  baseIntervalMin: 1440,
  maxIntervalMin: 4320,
  snapshotKey: CJ_BANNER_CACHE_KEY,
  affects: ["images"],
  configured: env("CJ_API_KEY", "CJ_WEBSITE_ID"),
  fetch: async () => ({ items: await fetchCjBannersStrict() }),
  itemKey: (b) => b.imageUrl,
  minItemsForDropCheck: 10,
  isValidItem: (b) => isHttp(b.imageUrl),
};

const affialCoupons: FeedSourceDef<AffialFeedCoupon> = {
  id: "affial-coupons",
  provider: "affial",
  label: "Affial – XML kupóny",
  url: "https://www.affial.com/kupony_feed.xml",
  format: "xml",
  tier: "high",
  baseIntervalMin: 180,
  maxIntervalMin: 720,
  snapshotKey: AFFIAL_SNAPSHOT_KEY,
  affects: ["coupons", "actions"],
  configured: () => true,
  minItemsForDropCheck: 10,
  async fetch(ctx) {
    const res = await fetchAffialFeed(ctx);
    return res.items ? { ...res, items: res.items.map((c) => cleanFields(c, ["title", "description", "campaign_name"])) } : res;
  },
  // Stabilný fingerprint (obchod + kód + titulok) — feed nemusí mať trvalé ID.
  itemKey: (c) => `${c.campaign_name.toLowerCase()}|${c.code.trim().toUpperCase()}|${c.title.toLowerCase()}`,
  isValidItem: (c) => Boolean(c.campaign_name),
};

/** Poradie = poradie spúšťania v ticku (Dognet sekvenčne kvôli rate-limitu). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogénny register zdrojov s rôznym typom položky
export const FEED_SOURCES: FeedSourceDef<any>[] = [
  dognetCoupons,
  dognetCampaigns,
  ehubVouchers,
  ehubCampaigns,
  affialCoupons,
  cjCoupons,
  cjShops,
  cjBanners,
];

export function getFeedSource(id: string): (typeof FEED_SOURCES)[number] | undefined {
  return FEED_SOURCES.find((s) => s.id === id);
}
