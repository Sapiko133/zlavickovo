export interface FeedProduct {
  id: string;
  name: string;
  description: string;
  price?: number;
  currency?: string;
  shop: string;
  shopDomain: string;
  affiliateLink: string;
  imageUrl?: string;
  category: string;
  source: "affial" | "awin" | "dognet" | "cj";
}

export interface FeedProvider {
  name: "affial" | "awin" | "dognet" | "cj";
  isActive?: boolean;
  feedUrl?: string;
  format?: "xml" | "csv" | "json";
  search(query: string): Promise<FeedProduct[]>;
  import(): Promise<void>;
  update(): Promise<void>;
  mapCategory(category: string): string;
}
