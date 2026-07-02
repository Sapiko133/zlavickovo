export interface HkFeedDef {
  id: string;
  url: string;
  domain: string;
  category: string;
  affiliateUrl: string | null;
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
}

export interface ImportFeedResult {
  feedId: string;
  domain: string;
  count: number;
  error?: string;
  durationMs: number;
}
