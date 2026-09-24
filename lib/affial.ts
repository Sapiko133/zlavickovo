import { XMLParser } from "fast-xml-parser";
import { unstable_cache } from "next/cache";
import { AFFIAL_SHOPS, buildAffialTrackingUrl } from "@/lib/affial-shops";
import { errorFromResponse, FeedError } from "@/lib/feeds/fetch";
import { feedVersionKey, readVersionedSnapshot, type FetchContext, type FetchResult } from "@/lib/feeds/engine";

export const AFFIAL_FEED_URL = "https://www.affial.com/kupony_feed.xml";
/** Snapshot Affial kupónov — plní feed engine (zdroj affial-coupons). */
export const AFFIAL_SNAPSHOT_KEY = "affial:coupons:v1";

const affialShopByDomain = new Map(AFFIAL_SHOPS.map(s => [s.domain.toLowerCase(), s.affiliateUrl]));

export interface AffialFeedCoupon {
  id: string;
  title: string;
  code: string;
  discount: string;
  description: string;
  campaign_name: string;
  affiliate_link: string;
  valid_to: string | null;
  type: 1;
  source: "affial";
}

/** Čistý parser Affial XML → normalizované kupóny (testovateľný bez siete). */
export function parseAffialXml(xml: string): AffialFeedCoupon[] {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const result = parser.parse(xml);

  const raw =
    result?.coupons?.coupon ||
    result?.feed?.item ||
    result?.rss?.channel?.item ||
    result?.items?.item ||
    [];
  const arr: any[] = Array.isArray(raw) ? raw : [raw];

  return arr
    .filter((item: any) => item && typeof item === "object")
    .map((item: any, i: number) => {
      const offerDomain = (item.offerName ?? "").toLowerCase();
      // Feed url je holá URL obchodu bez trackingu → obalíme ju account-level PAP
      // trackerom, aby KAŽDÝ Affial kupón bol monetizovaný (nie len tie v AFFIAL_SHOPS).
      const feedUrl = typeof item.url === "string" ? item.url : "";
      const trackingUrl =
        affialShopByDomain.get(offerDomain) ??
        (feedUrl.startsWith("http") ? buildAffialTrackingUrl(feedUrl) : null) ??
        item.affiliate_url ??
        item.link ??
        item.url ??
        "#";
      return {
        id: `affial-${item.id ?? item.coupon_id ?? i}`,
        title: String(item.title ?? item.name ?? ""),
        code: String(item.code ?? item.coupon_code ?? ""),
        discount: String(item.discount ?? item.value ?? ""),
        description: String(item.description ?? ""),
        campaign_name: String(item.offerName ?? item.shop_name ?? item.merchant_name ?? item.campaign_name ?? ""),
        affiliate_link: String(trackingUrl),
        valid_to: item.validTill ?? item.validTo ?? item.valid_to ?? item.expiry_date ?? null,
        type: 1 as const,
        source: "affial" as const,
      };
    });
}

/**
 * Feed engine: podmienený fetch (If-None-Match / If-Modified-Since). Keď sa
 * súbor nezmenil (304), nič sa nesťahuje ani neparsuje.
 */
export async function fetchAffialFeed(ctx: Pick<FetchContext, "etag" | "lastModified">): Promise<FetchResult<AffialFeedCoupon>> {
  const headers: Record<string, string> = { Accept: "application/xml,text/xml" };
  if (ctx.etag) headers["If-None-Match"] = ctx.etag;
  if (ctx.lastModified) headers["If-Modified-Since"] = ctx.lastModified;
  const res = await fetch(AFFIAL_FEED_URL, { headers, cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (res.status === 304) return { notModified: true, etag: ctx.etag, lastModified: ctx.lastModified };
  const httpErr = errorFromResponse(res, "Affial XML");
  if (httpErr) throw httpErr;
  const xml = await res.text();
  if (!/<\?xml|<coupons|<feed|<rss|<items/i.test(xml.slice(0, 500))) throw new FeedError("parse", "Affial: odpoveď nie je XML feed");
  return {
    items: parseAffialXml(xml),
    etag: res.headers.get("etag"),
    lastModified: res.headers.get("last-modified"),
  };
}

// Záložný živý fetch — len keď snapshot ešte neexistuje (prvé nasadenie).
const fetchAffialLive = unstable_cache(
  async () => {
    try {
      const res = await fetchAffialFeed({ etag: null, lastModified: null });
      return res.items ?? [];
    } catch {
      return [];
    }
  },
  ["affial-coupons"],
  { revalidate: 3600 },
);

export async function getAffialCoupons(): Promise<AffialFeedCoupon[]> {
  try {
    const snap = await readVersionedSnapshot<AffialFeedCoupon[]>(AFFIAL_SNAPSHOT_KEY, feedVersionKey("affial-coupons"));
    if (Array.isArray(snap) && snap.length > 0) return snap;
  } catch {}
  return fetchAffialLive();
}
