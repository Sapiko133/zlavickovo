import type { SupportedCurrency } from "@/lib/price";

export interface HkFeedDef {
  id: string;
  url: string;
  domain: string;
  category: string;
  affiliateUrl: string | null;
  currencyCode: SupportedCurrency | null;
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
  currency_code: SupportedCurrency | null;
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
  currency_code: SupportedCurrency | null;
  enabled: boolean;
  last_fetched_at: string | null;
  last_error: string | null;
  error_count: number;
  product_count: number;
  last_duration_ms: number;
}

export type HkImportMode = "audit" | "full";

export type HkFeedErrorType =
  | "timeout"
  | "http_error"
  | "parse_error"
  | "unsupported_format"
  | "empty_feed"
  | "size_limit"
  | "db_error"
  | "unknown_error";

export type HkImportRunStatus = "running" | "partial" | "success" | "error";

export type HkImportRunFeedStatus =
  | "pending"
  | "running"
  | "success"
  | "empty"
  | "error"
  | "partial"
  | "truncated"
  // Audit režim: vzorka feedu sa stiahla a sparsovala — feed je zdravý.
  // Do hk_import_run_feeds sa perzistuje ako 'success' (DB CHECK constraint),
  // audit kontext nesie hk_import_runs.mode = 'audit'.
  | "audit_success";

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
