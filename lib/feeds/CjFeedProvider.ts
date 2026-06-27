import type { FeedProduct, FeedProvider } from "./FeedProvider";

// TODO: Doplniť Commission Junction (CJ) feed
// 1. Registruj sa na https://www.cj.com/ ako publisher
// 2. API: https://advertiser-lookup.api.cj.com/v2/
// 3. Product feeds: https://product-search.api.cj.com/v2/product-search
// 4. Nastav env: CJ_API_KEY, CJ_WEBSITE_ID

export class CjFeedProvider implements FeedProvider {
  name = "cj" as const;

  async search(query: string): Promise<FeedProduct[]> {
    // TODO: Implementovať CJ product search API
    return [];
  }

  async import(): Promise<void> {
    // TODO: Importovať CJ produkty
  }

  async update(): Promise<void> {
    // TODO: Pravidelná aktualizácia
  }

  mapCategory(category: string): string {
    return category;
  }
}
