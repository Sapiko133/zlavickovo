import { redis } from "@/lib/redis";
import { searchMatchRank } from "@/lib/search-normalize";
import { importDognetFeeds, searchDognetProducts, getDognetProductCount } from "./DognetAutoFeed";
import { importAffialFeeds, searchAffialProducts, getAffialProductCount } from "./AffialAutoFeed";
import { importEhubFeeds, searchEhubProducts, getEhubProductCount } from "./EhubAutoFeed";
import { importCjFeeds, searchCjProducts, getCjProductCount } from "./CjAutoFeed";

export type { FeedProduct } from "./FeedProvider";

const LAST_IMPORT_KEY = "feed:last_import";

export interface ImportResult {
  dognet: { count: number; feeds: number };
  affial: { count: number; feeds: number };
  ehub: { count: number; feeds: number };
  cj: { count: number; feeds: number };
  total: number;
  timestamp: string;
}

export interface UnifiedProduct {
  name: string;
  description: string;
  price: string;
  url: string;
  imgUrl: string;
  domain: string;
  affiliateUrl: string;
  source: "dognet" | "affial" | "ehub" | "cj";
  category: string;
}

// Relevancia: exact (0) → startsWith (1) → word boundary (2) → substring (3),
// zhoda len v popise = 99 (na koniec). Normalizované bez diakritiky.
function relevanceRank(product: UnifiedProduct, query: string): number {
  const r = searchMatchRank(product.name, query);
  return r < 0 ? 99 : r;
}

class FeedManager {
  async search(query: string): Promise<UnifiedProduct[]> {
    const q = query.trim();
    if (!q) return [];

    const [dognet, affial, ehub, cj] = await Promise.allSettled([
      searchDognetProducts(q),
      searchAffialProducts(q),
      searchEhubProducts(q),
      searchCjProducts(q),
    ]);

    const all: UnifiedProduct[] = [
      ...(dognet.status === "fulfilled" ? dognet.value : []),
      ...(affial.status === "fulfilled"
        ? affial.value.map((p) => ({
            name: p.name,
            description: p.description,
            price: p.price,
            url: p.url,
            imgUrl: p.imgUrl,
            domain: p.domain,
            affiliateUrl: p.affiliateUrl,
            source: "affial" as const,
            category: p.category,
          }))
        : []),
      ...(ehub.status === "fulfilled" ? ehub.value : []),
      ...(cj.status === "fulfilled" ? cj.value : []),
    ];

    // Deduplicate by URL
    const seen = new Set<string>();
    const deduped = all.filter((p) => {
      if (seen.has(p.url)) return false;
      seen.add(p.url);
      return true;
    });

    // Sort by relevance (name match priority)
    deduped.sort((a, b) => relevanceRank(a, q) - relevanceRank(b, q));

    return deduped.slice(0, 20);
  }

  async importAll(): Promise<ImportResult> {
    const [dognet, affial, ehub, cj] = await Promise.allSettled([
      importDognetFeeds(),
      importAffialFeeds(),
      importEhubFeeds(),
      importCjFeeds(),
    ]);

    const result: ImportResult = {
      dognet: dognet.status === "fulfilled" ? dognet.value : { count: 0, feeds: 0 },
      affial: affial.status === "fulfilled" ? affial.value : { count: 0, feeds: 0 },
      ehub: ehub.status === "fulfilled" ? ehub.value : { count: 0, feeds: 0 },
      cj: cj.status === "fulfilled" ? cj.value : { count: 0, feeds: 0 },
      total: 0,
      timestamp: new Date().toISOString(),
    };
    result.total =
      result.dognet.count + result.affial.count + result.ehub.count + result.cj.count;

    try {
      await redis.set(LAST_IMPORT_KEY, result, { ex: 604800 });
    } catch {}

    return result;
  }

  async getStats(): Promise<{
    dognet: number;
    affial: number;
    ehub: number;
    cj: number;
    lastImport: ImportResult | null;
  }> {
    const [dognet, affial, ehub, cj, lastImport] = await Promise.allSettled([
      getDognetProductCount(),
      getAffialProductCount(),
      getEhubProductCount(),
      getCjProductCount(),
      redis.get<ImportResult>(LAST_IMPORT_KEY),
    ]);

    return {
      dognet: dognet.status === "fulfilled" ? dognet.value : 0,
      affial: affial.status === "fulfilled" ? affial.value : 0,
      ehub: ehub.status === "fulfilled" ? ehub.value : 0,
      cj: cj.status === "fulfilled" ? cj.value : 0,
      lastImport: lastImport.status === "fulfilled" ? lastImport.value : null,
    };
  }
}

export const feedManager = new FeedManager();
