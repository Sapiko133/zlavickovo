import { redis } from "@/lib/redis";
import { searchMatchRank } from "@/lib/search-normalize";
import { importDognetFeeds, searchDognetProducts } from "./DognetAutoFeed";
import { importAffialFeeds, searchAffialProducts } from "./AffialAutoFeed";
import { importEhubFeeds, searchEhubProducts } from "./EhubAutoFeed";
import { importCjFeeds, searchCjProducts } from "./CjAutoFeed";

export type { FeedProduct } from "./FeedProvider";

const LAST_IMPORT_KEY = "feed:last_import";

export interface ProviderImportResult {
  count: number;
  feeds: number;
  status: "success" | "empty" | "error";
  error?: string;
}

export type RefreshableProvider = "dognet" | "affial" | "ehub" | "cj";

const REFRESHABLE_PROVIDERS: readonly RefreshableProvider[] = ["dognet", "affial", "ehub", "cj"];

export function isRefreshableProvider(value: string): value is RefreshableProvider {
  return (REFRESHABLE_PROVIDERS as readonly string[]).includes(value);
}

function emptyProviderResult(): ProviderImportResult {
  return { count: 0, feeds: 0, status: "empty" };
}

export interface ImportResult {
  dognet: ProviderImportResult;
  affial: ProviderImportResult;
  ehub: ProviderImportResult;
  cj: ProviderImportResult;
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
  private importResult(
    settled: PromiseSettledResult<{ count: number; feeds: number }>
  ): ProviderImportResult {
    if (settled.status === "rejected") {
      const error = settled.reason instanceof Error ? settled.reason.message : String(settled.reason);
      return { count: 0, feeds: 0, status: "error", error: error.slice(0, 220) };
    }
    return {
      ...settled.value,
      status: settled.value.count > 0 ? "success" : "empty",
    };
  }

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
      dognet: this.importResult(dognet),
      affial: this.importResult(affial),
      ehub: this.importResult(ehub),
      cj: this.importResult(cj),
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

  /**
   * Obnoví iba jedného providera a zlúči výsledok do posledného import snapshotu
   * bez prepísania stavu ostatných providerov. Import funkcie zapisujú do cache iba
   * pri úspechu, takže čiastočné zlyhanie nezmaže poslednú zdravú cache.
   */
  async importProvider(provider: RefreshableProvider): Promise<ProviderImportResult> {
    const importFn = {
      dognet: importDognetFeeds,
      affial: importAffialFeeds,
      ehub: importEhubFeeds,
      cj: importCjFeeds,
    }[provider];

    const [settled] = await Promise.allSettled([importFn()]);
    const providerResult = this.importResult(settled);

    try {
      const prev = await redis.get<ImportResult>(LAST_IMPORT_KEY);
      const base: ImportResult = prev ?? {
        dognet: emptyProviderResult(),
        affial: emptyProviderResult(),
        ehub: emptyProviderResult(),
        cj: emptyProviderResult(),
        total: 0,
        timestamp: new Date().toISOString(),
      };
      const merged: ImportResult = {
        ...base,
        [provider]: providerResult,
        timestamp: new Date().toISOString(),
      };
      merged.total = merged.dognet.count + merged.affial.count + merged.ehub.count + merged.cj.count;
      await redis.set(LAST_IMPORT_KEY, merged, { ex: 604800 });
    } catch {}

    return providerResult;
  }

}

export const feedManager = new FeedManager();
