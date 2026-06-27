import type { FeedProduct, FeedProvider } from "./FeedProvider";

// TODO: Doplniť Dognet produkt feed
// 1. Dognet API: GET /api/v1/products/filter (ak existuje endpoint)
// 2. Alebo použiť existujúci /coupons/filter s expand=products
// 3. Nastav env: DOGNET_EMAIL, DOGNET_PASSWORD (už existujú)

export class DognetFeedProvider implements FeedProvider {
  name = "dognet" as const;

  async search(query: string): Promise<FeedProduct[]> {
    // TODO: Implementovať vyhľadávanie v Dognet produkt feede
    return [];
  }

  async import(): Promise<void> {
    // TODO: Importovať Dognet produkty
  }

  async update(): Promise<void> {
    // TODO: Pravidelná aktualizácia
  }

  mapCategory(category: string): string {
    const map: Record<string, string> = {
      "1": "elektronika",
      "2": "moda",
      "3": "sport",
      "4": "kozmetika",
      "5": "dom",
    };
    return map[category] ?? category;
  }
}
