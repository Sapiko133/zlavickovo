import type { FeedProduct } from "./FeedProvider";
import { AwinFeedProvider } from "./AwinFeedProvider";
import { DognetFeedProvider } from "./DognetFeedProvider";
import { CjFeedProvider } from "./CjFeedProvider";
import { searchProducts as searchAffialProducts } from "./AffialFeedProvider";
import { redis } from "@/lib/redis";

const FEEDS_KEY = "feeds:config";

interface FeedConfig {
  id: string;
  name: string;
  provider: "affial" | "awin" | "dognet" | "cj";
  url: string;
  format: "xml" | "csv" | "json";
  active: boolean;
}

class FeedManager {
  private staticProviders = [
    new AwinFeedProvider(),
    new DognetFeedProvider(),
    new CjFeedProvider(),
  ];

  async getActiveConfigs(): Promise<FeedConfig[]> {
    try {
      const configs = await redis.get<FeedConfig[]>(FEEDS_KEY);
      return (configs ?? []).filter((f) => f.active);
    } catch {
      return [];
    }
  }

  async search(query: string): Promise<FeedProduct[]> {
    const [staticResults, affialProducts] = await Promise.all([
      Promise.allSettled(this.staticProviders.map((p) => p.search(query))),
      searchAffialProducts(query).catch(() => []),
    ]);

    const affialFeedProducts: FeedProduct[] = affialProducts.map((p) => ({
      id: `affial-${p.domain}-${encodeURIComponent(p.url).slice(0, 32)}`,
      name: p.name,
      description: p.description,
      price: p.price ? parseFloat(p.price) || undefined : undefined,
      shop: p.domain,
      shopDomain: p.domain,
      affiliateLink: p.affiliateUrl,
      imageUrl: p.imgUrl || undefined,
      category: p.category,
      source: "affial" as const,
    }));

    const all = [
      ...staticResults.flatMap((r) => r.status === "fulfilled" ? r.value : []),
      ...affialFeedProducts,
    ];

    const seen = new Set<string>();
    return all.filter((p) => {
      if (seen.has(p.affiliateLink)) return false;
      seen.add(p.affiliateLink);
      return true;
    });
  }

  async updateAll(): Promise<void> {
    await Promise.allSettled(this.staticProviders.map((p) => p.update()));
  }
}

export const feedManager = new FeedManager();
