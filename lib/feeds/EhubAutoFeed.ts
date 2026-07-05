import { redis } from "@/lib/redis";
import { matchesSearchTokens } from "@/lib/search-normalize";
import { XMLParser } from "fast-xml-parser";

const CACHE_TTL = 21600;
const FEED_IDS_KEY = "ehub:feed_ids";

const EHUB_FEEDS = [
  { id: "ehub-nabytok", url: "https://client.datadepo.cz/api-af/export/huwigyxm2no7yawfmlim7ko3/?aid=85c7b80f", category: "byvanie" },
  { id: "ehub-tricka", url: "https://client.datadepo.cz/api-af/export/6ni2rc8e1xjejehhhyga7ba8/?aid=85c7b80f", category: "moda" },
  { id: "ehub-sport", url: "https://client.datadepo.cz/api-af/export/aezhf4nlsfuqhlk2qckz0plm/?aid=85c7b80f", category: "sport" },
  { id: "ehub-kabelky", url: "https://client.datadepo.cz/api-af/export/k9bfiyttm67oapkucq3a7188/?aid=85c7b80f", category: "moda" },
  { id: "ehub-boty", url: "https://client.datadepo.cz/api-af/export/1lv565bu31h6wqgy3f76jx9j/?aid=85c7b80f", category: "moda" },
];

export interface EhubFeedProduct {
  name: string;
  description: string;
  price: string;
  url: string;
  imgUrl: string;
  domain: string;
  affiliateUrl: string;
  source: "ehub";
  category: string;
}

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", parseTagValue: false });

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "").trim();
}

function parseXML(xml: string, category: string): EhubFeedProduct[] {
  try {
    const parsed = parser.parse(xml);
    const shopRoot = parsed?.SHOP ?? parsed?.shop ?? parsed;
    const rawItems = shopRoot?.SHOPITEM ?? shopRoot?.shopitem;
    if (!rawItems) return [];

    const items: any[] = Array.isArray(rawItems) ? rawItems : [rawItems];
    return items
      .filter((item: any) => item && typeof item === "object")
      .slice(0, 500)
      .map((item: any): EhubFeedProduct => {
        const url = String(item.URL ?? item.url ?? "").trim();
        return {
          name: String(item.PRODUCTNAME ?? item.NAME ?? item.productname ?? "").trim(),
          description: stripHtml(String(item.DESCRIPTION ?? item.description ?? "")).slice(0, 200),
          price: String(item.PRICE_VAT ?? item.PRICE ?? item.price ?? "").trim(),
          url,
          imgUrl: String(item.IMAGE_MAIN ?? item.IMGURL ?? item.IMGURL_ALTERNATIVE ?? "").trim(),
          domain: extractDomain(url),
          affiliateUrl: url,
          source: "ehub",
          category,
        };
      })
      .filter((p) => p.name && p.url);
  } catch {
    return [];
  }
}

async function fetchAndCache(feedId: string, feedUrl: string, category: string): Promise<number> {
  const cacheKey = `ehub_products:${feedId}`;
  try {
    const res = await fetch(feedUrl, {
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Zlavickovo/1.0)" },
    });
    if (!res.ok) return 0;
    const xml = await res.text();
    const products = parseXML(xml, category);
    if (products.length > 0) {
      await redis.set(cacheKey, products, { ex: CACHE_TTL });
      await redis.sadd(FEED_IDS_KEY, feedId);
    }
    return products.length;
  } catch {
    return 0;
  }
}

export async function importEhubFeeds(): Promise<{ count: number; feeds: number }> {
  const allFeeds = [...EHUB_FEEDS];

  // Check for custom eHub feeds from Redis
  try {
    const custom = await redis.get<{ id: string; url: string; category: string }[]>("feeds:custom:ehub");
    if (custom && Array.isArray(custom)) allFeeds.push(...custom);
  } catch {}

  const counts = await Promise.all(allFeeds.map((f) => fetchAndCache(f.id, f.url, f.category)));
  return { count: counts.reduce((a, b) => a + b, 0), feeds: allFeeds.length };
}

export async function searchEhubProducts(query: string): Promise<EhubFeedProduct[]> {
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
        const products = await redis.get<EhubFeedProduct[]>(`ehub_products:${id}`);
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

export async function getEhubProductCount(): Promise<number> {
  try {
    const feedIds = await redis.smembers(FEED_IDS_KEY) as string[];
    const counts = await Promise.all(
      feedIds.map(async (id) => {
        const p = await redis.get<any[]>(`ehub_products:${id}`);
        return p?.length ?? 0;
      })
    );
    return counts.reduce((a, b) => a + b, 0);
  } catch {
    return 0;
  }
}
