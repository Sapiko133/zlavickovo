import { redis } from "@/lib/redis";

export interface CjCoupon {
  id: string;
  advertiserId: string;
  advertiserName: string;
  code: string;
  description: string;
  startDate: string;
  endDate: string;
  link: string;
  discount: string;
  discountType: string;
  source: "cj";
}

const CACHE_KEY = "cj:coupons";
const CACHE_TTL = 3600; // 1 hodina

const GQL_QUERY = `
  query {
    publisherAccount {
      coupons(limit: 100) {
        totalCount
        resultList {
          advertiserId
          advertiserName
          code
          description
          startDate
          endDate
          link
          discount
          discountType
        }
      }
    }
  }
`;

async function fetchCjCoupons(): Promise<CjCoupon[]> {
  const apiKey = process.env.CJ_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await fetch("https://ads.api.cj.com/query", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: GQL_QUERY }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];

    const json = await res.json();
    const list: any[] = json?.data?.publisherAccount?.coupons?.resultList ?? [];
    return list.map((c: any, i: number): CjCoupon => ({
      id: `cj-${c.advertiserId ?? i}-${i}`,
      advertiserId: c.advertiserId ?? "",
      advertiserName: c.advertiserName ?? "",
      code: c.code ?? "",
      description: c.description ?? "",
      startDate: c.startDate ?? "",
      endDate: c.endDate ?? "",
      link: c.link ?? "",
      discount: c.discount ?? "",
      discountType: c.discountType ?? "",
      source: "cj",
    }));
  } catch {
    return [];
  }
}

export async function getCjCoupons(): Promise<CjCoupon[]> {
  try {
    const cached = await redis.get<CjCoupon[]>(CACHE_KEY);
    if (cached && Array.isArray(cached) && cached.length > 0) return cached;
  } catch {}

  const coupons = await fetchCjCoupons();
  if (coupons.length > 0) {
    try {
      await redis.set(CACHE_KEY, coupons, { ex: CACHE_TTL });
    } catch {}
  }
  return coupons;
}

export async function getCjCouponsByShop(shopName: string): Promise<CjCoupon[]> {
  const all = await getCjCoupons();
  const lq = shopName.toLowerCase();
  return all.filter((c) => c.advertiserName.toLowerCase().includes(lq));
}

export async function importAndCacheCjCoupons(): Promise<number> {
  const coupons = await fetchCjCoupons();
  if (coupons.length > 0) {
    try {
      await redis.set(CACHE_KEY, coupons, { ex: CACHE_TTL });
    } catch {}
  }
  return coupons.length;
}
