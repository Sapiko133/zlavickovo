import { getToken } from "@/lib/dognet";
import { redis } from "@/lib/redis";
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

function parseXML(xml: string, domain: string): AutoFeedProduct[] {
  try {
    const parsed = parser.parse(xml);
    const shopRoot = parsed?.SHOP ?? parsed?.shop ?? parsed;
    const rawItems = shopRoot?.SHOPITEM ?? shopRoot?.shopitem;
    if (!rawItems) return [];

    const items: any[] = Array.isArray(rawItems) ? rawItems : [rawItems];
    return items
      .filter((item: any) => item && typeof item === "object")
      .slice(0, 500)
      .map((item: any): AutoFeedProduct => {
        const url = String(item.URL ?? item.url ?? "").trim();
        return {
          name: String(item.PRODUCTNAME ?? item.NAME ?? item.productname ?? "").trim(),
          description: stripHtml(String(item.DESCRIPTION ?? item.description ?? "")).slice(0, 200),
          price: String(item.PRICE_VAT ?? item.PRICE ?? item.price ?? "").trim(),
          url,
          imgUrl: String(item.IMGURL ?? item.IMAGE_MAIN ?? item.IMGURL_ALTERNATIVE ?? "").trim(),
          domain: domain || extractDomain(url),
          affiliateUrl: url,
          source: "dognet",
          category: String(item.CATEGORY_FULL ?? item.CATEGORYTEXT ?? "").trim(),
        };
      })
      .filter((p) => p.name && p.url);
  } catch {
    return [];
  }
}

async function fetchAndCache(feedUrl: string, feedId: string): Promise<number> {
  const cacheKey = `dognet_products:${feedId}`;
  try {
    const res = await fetch(feedUrl, {
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Zlavickovo/1.0)" },
    });
    if (!res.ok) return 0;
    const xml = await res.text();
    const domain = extractDomain(feedUrl);
    const products = parseXML(xml, domain);
    if (products.length > 0) {
      await redis.set(cacheKey, products, { ex: CACHE_TTL });
      await redis.sadd(FEED_IDS_KEY, feedId);
    }
    return products.length;
  } catch {
    return 0;
  }
}

export async function importDognetFeeds(): Promise<{ count: number; feeds: number }> {
  let feedList: { url: string; id: string }[] = [];

  // Try Dognet API for XML feed list
  try {
    const token = await getToken();
    const res = await fetch("https://api.app.dognet.com/api/v1/xml-feeds", {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = await res.json();
      const feeds: any[] = data.data ?? data.feeds ?? [];
      feedList = feeds
        .map((f: any) => ({
          url: String(f.url ?? f.feed_url ?? "").trim(),
          id: String(f.id ?? f.feed_id ?? f.url).trim(),
        }))
        .filter((f) => f.url);
    }
  } catch {}

  // Fallback: custom feeds from Redis
  if (feedList.length === 0) {
    try {
      const custom = await redis.get<{ url: string; id: string }[]>(CUSTOM_FEEDS_KEY);
      if (custom && Array.isArray(custom)) feedList = custom;
    } catch {}
  }

  if (feedList.length === 0) return { count: 0, feeds: 0 };

  const counts = await Promise.all(feedList.map((f) => fetchAndCache(f.url, f.id)));
  return { count: counts.reduce((a, b) => a + b, 0), feeds: feedList.length };
}

export async function searchDognetProducts(query: string): Promise<AutoFeedProduct[]> {
  const lq = query.toLowerCase().trim();
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
          .filter((p) => p.name.toLowerCase().includes(lq) || p.description.toLowerCase().includes(lq))
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
