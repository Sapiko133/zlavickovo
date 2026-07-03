import { AFFIAL_SHOPS } from "@/lib/affial-shops";
import { getEhubShops } from "@/lib/ehub";
import { getCoupons as getDognetCoupons } from "@/lib/dognet";
import { createShopMatcher } from "@/lib/shop-match";
import { getShopPriority } from "@/lib/shop-priority";

/**
 * Affiliate preklik do obchodu — jediné pravidlo:
 * ak affiliate URL existuje (Dognet → eHub → Affial), použije sa vždy;
 * priamy odkaz na obchod je len posledný fallback.
 */

function couponLink(c: any): string {
  if (typeof c?.affiliate_link === "string" && c.affiliate_link.startsWith("http")) return c.affiliate_link;
  if (typeof c?.url === "string" && c.url.startsWith("http")) return c.url;
  return "";
}

/** Affiliate URL obchodu z už načítaných kupónov (getCouponsByShop). Priorita: Dognet → eHub → Affial. */
export function affiliateUrlFromCoupons(coupons: any[]): string | null {
  const dognet = coupons.find((c: any) => couponLink(c).includes("go.dognet.com"));
  if (dognet) return couponLink(dognet);
  const ehub = coupons.find((c: any) => c?.source === "ehub" && couponLink(c));
  if (ehub) return couponLink(ehub);
  const affial = coupons.find((c: any) => couponLink(c).includes("affial.com"));
  if (affial) return couponLink(affial);
  return null;
}

/** Kupón/akcia s priamym odkazom bez trackingu — smie sa nahradiť shop affiliate URL. */
export function hasDirectLink(c: any): boolean {
  if (c?.source === "static-akcia") return true;
  if (c?.source === "affial-static" && !couponLink(c).includes("affial.com")) return true;
  return false;
}

/** Krajinská priorita eHub kampane (.sk > .cz > ostatné) podľa webu, inak názvu. */
function ehubCountryPriority(s: { name?: string; web?: string }): number {
  const host = (s.web || "")
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[/?#].*$/, "");
  return getShopPriority(host || s.name || "");
}

/** Shop-level affiliate URL zo zdrojov mimo kupónov: Affial partneri → eHub kampane (defaultLink). */
export async function getShopAffiliateUrl(shopName: string): Promise<string | null> {
  const matches = createShopMatcher(shopName);

  const affial = AFFIAL_SHOPS.find(s => matches(s.name, s.domain));
  if (affial?.affiliateUrl?.startsWith("http")) return affial.affiliateUrl;

  // Tá istá značka môže mať viac krajinských programov (Aquaangels.sk aj
  // Aqua-angels.cz) — vyber .sk pred .cz, nie prvý match v poradí feedu.
  const ehubShops = await getEhubShops().catch(() => []);
  const ehub = ehubShops
    .filter(s => matches(s.name, s.web) && s.affiliateLink?.startsWith("http"))
    .sort((a, b) => ehubCountryPriority(a) - ehubCountryPriority(b))[0];
  if (ehub) return ehub.affiliateLink;

  return null;
}

/** Pre statické akcie doplní affiliate URL (Dognet kupón → Affial partner → eHub kampaň), ak existuje. */
export async function resolveAkciaAffiliateUrls<
  T extends { shopName: string; domain: string; affiliateUrl: string }
>(akcie: T[]): Promise<T[]> {
  const [dognetCoupons, ehubShops] = await Promise.all([
    getDognetCoupons().catch(() => []),
    getEhubShops().catch(() => []),
  ]);

  return akcie.map(a => {
    const matches = createShopMatcher(a.shopName);

    const dognet = dognetCoupons.find((c: any) =>
      matches(c.campaign?.name, c.campaign?.url ?? c.campaign?.website_url) &&
      couponLink(c).includes("go.dognet.com")
    );
    const affial = AFFIAL_SHOPS.find(s => matches(s.name, s.domain));
    const ehub = ehubShops.find(s => matches(s.name, s.web));

    const affiliateUrl =
      (dognet ? couponLink(dognet) : null) ??
      (affial?.affiliateUrl?.startsWith("http") ? affial.affiliateUrl : null) ??
      (ehub?.affiliateLink?.startsWith("http") ? ehub.affiliateLink : null);

    return affiliateUrl ? { ...a, affiliateUrl } : a;
  });
}
