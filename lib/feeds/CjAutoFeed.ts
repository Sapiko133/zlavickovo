import { importAndCacheCjCoupons } from "@/lib/cj";

export interface CjProduct {
  name: string;
  description: string;
  price: string;
  url: string;
  imgUrl: string;
  domain: string;
  affiliateUrl: string;
  source: "cj";
  category: string;
}

export async function importCjFeeds(): Promise<{ count: number; feeds: number }> {
  const count = await importAndCacheCjCoupons();
  return { count, feeds: count > 0 ? 1 : 0 };
}

export async function searchCjProducts(_query: string): Promise<CjProduct[]> {
  return [];
}

export async function getCjProductCount(): Promise<number> {
  return 0;
}
