import type { FeedProduct } from "./FeedProvider";
import { AwinFeedProvider } from "./AwinFeedProvider";
import { DognetFeedProvider } from "./DognetFeedProvider";
import { CjFeedProvider } from "./CjFeedProvider";

class FeedManager {
  private providers = [
    new AwinFeedProvider(),
    new DognetFeedProvider(),
    new CjFeedProvider(),
  ];

  async search(query: string): Promise<FeedProduct[]> {
    const results = await Promise.allSettled(
      this.providers.map(p => p.search(query))
    );

    const all = results.flatMap(r =>
      r.status === "fulfilled" ? r.value : []
    );

    // Deduplikuj podľa affiliateLink
    const seen = new Set<string>();
    return all.filter(p => {
      if (seen.has(p.affiliateLink)) return false;
      seen.add(p.affiliateLink);
      return true;
    });
  }

  async updateAll(): Promise<void> {
    await Promise.allSettled(this.providers.map(p => p.update()));
  }
}

export const feedManager = new FeedManager();
