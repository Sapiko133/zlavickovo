export interface HkFeedDef {
  id: string;
  url: string;
  domain: string;
  category: string;
  affiliateUrl: string | null;
  // Produkty, ktorých názov (bez diakritiky, lowercase) obsahuje niektorý z týchto výrazov,
  // sa neimportujú a existujúce sa pri importe zmažú z hk_products
  exclude?: string[];
}

export interface HkProduct {
  id: number;
  feed_id: string;
  name: string;
  description: string;
  price: string;
  url: string;
  img_url: string;
  domain: string;
  category: string;
  affiliate_url: string | null;
  ean: string;
  item_id: string;
  manufacturer: string;
  productno: string;
  updated_at: string;
}

export interface HkFeedRow {
  id: string;
  url: string;
  domain: string;
  category: string;
  affiliate_url: string;
  enabled: boolean;
  last_fetched_at: string | null;
  last_error: string | null;
  error_count: number;
  product_count: number;
  last_duration_ms: number;
}

export type HkFeedErrorType = "timeout" | "http_error" | "parse_error" | "unknown_error";

export interface ImportFeedResult {
  feedId: string;
  domain: string;
  count: number;
  error?: string;
  errorType?: HkFeedErrorType; // klasifikácia chyby (len ak feed zlyhal)
  empty?: boolean;             // feed prešiel, ale XML neobsahovalo produkty
  durationMs: number;
}

// Výsledok bezpečnostného čistenia DB pri importe
export interface PruneResult {
  orphanProducts: number;   // zmazané produkty feedov, ktoré už nie sú v HEUREKA_FEEDS
  orphanFeeds: number;      // zmazané riadky z hk_feeds
  excludedProducts: number; // zmazané produkty matchujúce exclude filter feedu
}
