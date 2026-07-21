import { redis } from "@/lib/redis";
import { normalizeShopSlug } from "@/lib/slug";
import { getShopDomain } from "@/lib/shop-domains";
import { createShopMatcher } from "@/lib/shop-match";

/**
 * Manuálne kupóny pridané cez admin (/admin/kupony). Doplnok k sieťovým kupónom
 * (Dognet/eHub/CJ/Affial) — zobrazujú sa na /kupony/[slug] aj v článkoch.
 * Úložisko: Redis hash `manual_coupons` (field = id).
 */

const KEY = "manual_coupons";

export interface ManualCoupon {
  id: string;
  shopName: string;
  shopSlug: string;
  code: string;
  title: string;
  discount?: string;
  url: string;        // affiliate/cieľová URL — otvorí sa pri odhalení kódu
  validTo?: string | null;
  createdAt: string;
}

export async function getAllManualCoupons(): Promise<ManualCoupon[]> {
  try {
    const map = await redis.hgetall<Record<string, ManualCoupon>>(KEY);
    if (!map) return [];
    return Object.values(map)
      .filter((c): c is ManualCoupon => !!c && typeof c === "object" && !!c.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export async function saveManualCoupon(c: ManualCoupon): Promise<void> {
  await redis.hset(KEY, { [c.id]: c });
}

export async function deleteManualCoupon(id: string): Promise<void> {
  await redis.hdel(KEY, id);
}

/** Manuálne kupóny pre obchod, v tvare zhodnom s ostatnými zdrojmi (getCouponsByShop). */
export async function getManualCouponsByShop(shopName: string): Promise<any[]> {
  const matches = createShopMatcher(shopName);
  const all = await getAllManualCoupons();
  return all
    .filter((c) => matches(c.shopName, c.shopSlug))
    .map((c) => {
      const link = c.url?.startsWith("http")
        ? c.url
        : `https://${getShopDomain(c.shopName) || `${c.shopSlug}.sk`}`;
      return {
        id: c.id,
        code: c.code,
        title: c.title,
        name: c.title,
        description: c.discount ? `${c.discount} zľava` : c.title,
        type: 1,
        affiliate_link: link,
        url: link,
        valid_to: c.validTo ?? null,
        campaign: { name: c.shopName },
        campaign_name: c.shopName,
        source: "manual" as const,
      };
    });
}

export function newManualCouponId(shopSlug: string): string {
  return `manual-${shopSlug}-${Date.now()}`;
}

export { normalizeShopSlug };
