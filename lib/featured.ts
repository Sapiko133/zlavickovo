import { redis } from "@/lib/redis";

export interface FeaturedShop {
  name: string;
  slug: string;
  color: string;
  promoText: string;
  topDeal: string;
  featured: boolean;
  featuredUntil: string;
}

const REDIS_KEY = "featured_shops";

export const FEATURED_SHOPS: FeaturedShop[] = [
  {
    name: "Alza",
    slug: "alza",
    color: "#0065BD",
    promoText: "Najväčší výber elektroniky na Slovensku",
    topDeal: "až 20% zľava",
    featured: true,
    featuredUntil: "2026-12-31",
  },
  {
    name: "Zalando",
    slug: "zalando",
    color: "#FF6900",
    promoText: "Módne oblečenie a obuv so zľavou",
    topDeal: "až 20% zľava",
    featured: true,
    featuredUntil: "2026-12-31",
  },
];

export function getActiveFeatured(): FeaturedShop[] {
  const now = new Date().toISOString().split("T")[0];
  return FEATURED_SHOPS.filter(s => s.featured && s.featuredUntil >= now);
}

export async function getAllFeaturedFromRedis(): Promise<FeaturedShop[]> {
  try {
    const stored = await redis.get<FeaturedShop[]>(REDIS_KEY);
    return stored ?? FEATURED_SHOPS;
  } catch {
    return FEATURED_SHOPS;
  }
}

export async function saveFeaturedShops(shops: FeaturedShop[]): Promise<void> {
  await redis.set(REDIS_KEY, shops);
}

export async function getActiveFeaturedDynamic(): Promise<FeaturedShop[]> {
  try {
    const stored = await redis.get<FeaturedShop[]>(REDIS_KEY);
    if (stored && stored.length > 0) {
      const now = new Date().toISOString().split("T")[0];
      return stored.filter(s => s.featured && s.featuredUntil >= now);
    }
  } catch {}
  return getActiveFeatured();
}
