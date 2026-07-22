import { getToken, getDognetChid, buildDognetTrackingUrl } from "@/lib/dognet";
import { redis } from "@/lib/redis";
import { matchesSearchTokens } from "@/lib/search-normalize";
import { XMLParser } from "fast-xml-parser";

const CACHE_TTL = 21600;
const FEED_IDS_KEY = "dognet:feed_ids";
const CUSTOM_FEEDS_KEY = "feeds:custom:dognet";

export interface AutoFeedProduct {
  name: string;
  description: string;
  price: string;
  url: string;
  imgUrl: string;
  domain: string;
  affiliateUrl: string;
  source: "dognet";
  category: string;
}

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", parseTagValue: false });

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "").trim();
}

/** Prvá neprázdna hodnota z viacerých možných kľúčov (rôzne formáty/namespaces). */
function pick(obj: any, keys: string[]): string {
  for (const k of keys) {
    const v = obj?.[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return "";
}

// Heureka formát: <SHOP><SHOPITEM>… (PRODUCTNAME, PRICE_VAT, URL, IMGURL)
function parseHeurekaItems(items: any[]): AutoFeedProduct[] {
  return items
    .filter((item: any) => item && typeof item === "object")
    .slice(0, 500)
    .map((item: any): AutoFeedProduct => {
      const url = pick(item, ["URL", "url"]);
      return {
        name: pick(item, ["PRODUCTNAME", "NAME", "productname"]),
        description: stripHtml(pick(item, ["DESCRIPTION", "description"])).slice(0, 200),
        price: pick(item, ["PRICE_VAT", "PRICE", "price"]),
        url,
        imgUrl: pick(item, ["IMGURL", "IMAGE_MAIN", "IMGURL_ALTERNATIVE"]),
        domain: extractDomain(url),
        affiliateUrl: url,
        source: "dognet",
        category: pick(item, ["CATEGORY_FULL", "CATEGORYTEXT"]),
      };
    })
    .filter((p) => p.name && p.url);
}

// Google Shopping / RSS formát: <rss><channel><item> s g: namespace poľami
function parseGoogleItems(items: any[]): AutoFeedProduct[] {
  return items
    .filter((item: any) => item && typeof item === "object")
    .slice(0, 500)
    .map((item: any): AutoFeedProduct => {
      const url = pick(item, ["g:link", "link", "g:url", "url"]);
      return {
        name: pick(item, ["g:title", "title"]),
        description: stripHtml(pick(item, ["g:description", "description"])).slice(0, 200),
        price: pick(item, ["g:sale_price", "g:price", "price"]),
        url,
        imgUrl: pick(item, ["g:image_link", "image_link", "g:image", "image"]),
        domain: extractDomain(url),
        affiliateUrl: url,
        source: "dognet",
        category: pick(item, ["g:product_type", "g:google_product_category", "product_type"]),
      };
    })
    .filter((p) => p.name && p.url);
}

// Podporuje Heureka (SHOP/SHOPITEM) aj Google Shopping (rss/channel/item).
function parseXML(xml: string): AutoFeedProduct[] {
  try {
    const parsed = parser.parse(xml);

    const shopRoot = parsed?.SHOP ?? parsed?.shop ?? parsed;
    const heureka = shopRoot?.SHOPITEM ?? shopRoot?.shopitem;
    if (heureka) return parseHeurekaItems(Array.isArray(heureka) ? heureka : [heureka]);

    const channel = parsed?.rss?.channel ?? parsed?.RSS?.channel ?? parsed?.channel;
    const rssItems = channel?.item ?? channel?.ITEM;
    if (rssItems) return parseGoogleItems(Array.isArray(rssItems) ? rssItems : [rssItems]);

    return [];
  } catch {
    return [];
  }
}

async function fetchAndCache(feedUrl: string, feedId: string, chid: string): Promise<number> {
  const cacheKey = `dognet_products:${feedId}`;
  try {
    const res = await fetch(feedUrl, {
      signal: AbortSignal.timeout(12000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Zlavickovo/1.0)" },
    });
    if (!res.ok) return 0;
    const xml = await res.text();
    const products = parseXML(xml);
    if (products.length === 0) return 0;
    // Outbound cez Dognet tracking redirect (monetizácia) — fallback raw URL.
    for (const p of products) {
      p.affiliateUrl = buildDognetTrackingUrl(chid, p.url) ?? p.url;
    }
    await redis.set(cacheKey, products, { ex: CACHE_TTL });
    await redis.sadd(FEED_IDS_KEY, feedId);
    return products.length;
  } catch {
    return 0;
  }
}

// Bezpečný cap — cron (300s) aj Redis zvládnu, dá sa neskôr zvýšiť.
const MAX_DOGNET_FEEDS = 40;
const FEEDS_PER_PAGE = 200;
const MAX_FEED_PAGES = 6; // scan max ~1200 feedov, kým nazbiera MAX schválených

/** Zoznam schválených XML feedov z Dognet API (POST /campaigns/feeds/filter, pagination). */
async function discoverDognetFeeds(token: string): Promise<{ url: string; id: string }[]> {
  const out: { url: string; id: string }[] = [];
  for (let page = 1; page <= MAX_FEED_PAGES && out.length < MAX_DOGNET_FEEDS; page++) {
    try {
      const res = await fetch(`https://api.app.dognet.com/api/v1/campaigns/feeds/filter?page=${page}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ "per-page": FEEDS_PER_PAGE }),
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) break;
      const data = await res.json();
      const feeds: any[] = data.data ?? data.feeds ?? [];
      if (feeds.length === 0) break;
      for (const f of feeds) {
        const url = String(f.url ?? "").trim();
        // len schválené (feed_allowed) XML feedy (format 1) s reálnou URL
        if (!f.feed_allowed) continue;
        if (Number(f.format) !== 1) continue;
        if (!url.startsWith("http")) continue;
        out.push({ url, id: String(f.id) });
        if (out.length >= MAX_DOGNET_FEEDS) break;
      }
    } catch {
      break;
    }
  }
  return out;
}

export async function importDognetFeeds(): Promise<{ count: number; feeds: number }> {
  let feedList: { url: string; id: string }[] = [];

  try {
    const token = await getToken();
    feedList = await discoverDognetFeeds(token);
  } catch {}

  // Fallback: ručne pridané feedy z Redis (admin)
  if (feedList.length === 0) {
    try {
      const custom = await redis.get<{ url: string; id: string }[]>(CUSTOM_FEEDS_KEY);
      if (custom && Array.isArray(custom)) feedList = custom.slice(0, MAX_DOGNET_FEEDS);
    } catch {}
  }

  if (feedList.length === 0) return { count: 0, feeds: 0 };

  const chid = await getDognetChid().catch(() => "");
  const counts = await Promise.all(feedList.map((f) => fetchAndCache(f.url, f.id, chid)));
  return { count: counts.reduce((a, b) => a + b, 0), feeds: feedList.length };
}

export async function searchDognetProducts(query: string): Promise<AutoFeedProduct[]> {
  const lq = query.trim();
  if (!lq) return [];

  let feedIds: string[] = [];
  try {
    feedIds = await redis.smembers(FEED_IDS_KEY) as string[];
  } catch {
    return [];
  }

  const results = await Promise.all(
    feedIds.map(async (id) => {
      try {
        const products = await redis.get<AutoFeedProduct[]>(`dognet_products:${id}`);
        return (products ?? [])
          .filter((p) => matchesSearchTokens(p.name, lq) || matchesSearchTokens(p.description, lq))
          .slice(0, 3);
      } catch {
        return [];
      }
    })
  );
  return results.flat().slice(0, 20);
}

export async function getDognetProductCount(): Promise<number> {
  try {
    const feedIds = await redis.smembers(FEED_IDS_KEY) as string[];
    const counts = await Promise.all(
      feedIds.map(async (id) => {
        const p = await redis.get<any[]>(`dognet_products:${id}`);
        return p?.length ?? 0;
      })
    );
    return counts.reduce((a, b) => a + b, 0);
  } catch {
    return 0;
  }
}
