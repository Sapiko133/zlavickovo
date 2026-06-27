// CJ (Commission Junction) — TODO: requires CJ_API_KEY
// process.env.CJ_API_KEY

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
  return { count: 0, feeds: 0 };
}

export async function searchCjProducts(_query: string): Promise<CjProduct[]> {
  return [];
}

export async function getCjProductCount(): Promise<number> {
  return 0;
}
