import type { FeedProduct, FeedProvider } from "./FeedProvider";

// TODO: Doplniť AWIN feed
// 1. Získaj AWIN Publisher ID z https://ui.awin.com/
// 2. Stiahni produkt feed: GET https://productdata.awin.com/datafeed/list/apikey/{AWIN_API_KEY}/v/2/
// 3. Nastav env: AWIN_API_KEY, AWIN_PUBLISHER_ID
// 4. Implementuj parsovanie XML/CSV feedu

export class AwinFeedProvider implements FeedProvider {
  name = "awin" as const;

  async search(query: string): Promise<FeedProduct[]> {
    // TODO: Implementovať vyhľadávanie v AWIN produkt feede
    return [];
  }

  async import(): Promise<void> {
    // TODO: Stiahnuť a uložiť AWIN feed do Redis/DB
  }

  async update(): Promise<void> {
    // TODO: Pravidelná aktualizácia fedu (cron job)
  }

  mapCategory(category: string): string {
    const map: Record<string, string> = {
      "fashion": "moda",
      "electronics": "elektronika",
      "sports": "sport",
      "beauty": "kozmetika",
      "home": "dom",
    };
    return map[category.toLowerCase()] ?? category;
  }
}
