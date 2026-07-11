import { getCoupons } from "@/lib/dognet";
import { getAffialCoupons } from "@/lib/affial";
import { getEhubCoupons } from "@/lib/ehub";
import { getCjCoupons } from "@/lib/cj";
import { AFFIAL_COUPONS } from "@/lib/affial-coupons";
import { AFFIAL_SHOPS } from "@/lib/affial-shops";
import { STATIC_AKCIE } from "@/lib/akcie";
import { createShopMatcher } from "@/lib/shop-match";

// Kupón obchodu (má kód) alebo akcia (bez kódu, len odkaz) — pripája sa
// k produktu podľa domény obchodu. NIE je to porovnávač: len ukazuje, či má
// obchod daného produktu dostupný kód / prebiehajúcu akciu.
export interface ShopCoupon {
  code: string;
  title: string;
  link: string;
}
export interface ShopDeal {
  title: string;
  link: string;
}
export interface ShopOffer {
  coupon: ShopCoupon | null;
  deal: ShopDeal | null;
}

// Zjednotený tvar naprieč zdrojmi kupónov/akcií + presné doménové párovanie —
// čistá logika žije v lib/offer-domain.ts (bez siete, testovateľná samostatne).
import {
  buildOffersByExactDomain,
  notExpired,
  type ExactDomainOffer,
  type OfferRecord,
} from "@/lib/offer-domain";

export {
  buildOffersByExactDomain,
  exactDomainKey,
  type ExactDomainCoupon,
  type ExactDomainDeal,
  type ExactDomainOffer,
  type OfferRecord,
} from "@/lib/offer-domain";

async function loadOfferRecords(): Promise<OfferRecord[]> {
  const [dognetAll, affialAll, ehubAll, cjAll] = await Promise.all([
    getCoupons().catch(() => []),
    getAffialCoupons().catch(() => []),
    getEhubCoupons().catch(() => []),
    getCjCoupons().catch(() => []),
  ]);

  const records: OfferRecord[] = [];

  for (const c of dognetAll as any[]) {
    records.push({
      shopName: c.campaign?.name || "",
      domain: (c.campaign?.url || c.campaign?.website_url || "").toString(),
      code: (c.code || "").trim(),
      title: c.title || c.name || c.description || "",
      link: c.affiliate_link || c.url || "",
      validTo: c.valid_to || null,
    });
  }
  for (const c of affialAll as any[]) {
    records.push({
      shopName: c.campaign_name || "",
      domain: c.campaign_name || "",
      code: (c.code || "").trim(),
      title: c.title || c.description || "",
      link: c.affiliate_link || c.url || "",
      validTo: c.valid_to || null,
    });
  }
  for (const c of ehubAll as any[]) {
    records.push({
      shopName: c.campaign_name || "",
      domain: "",
      code: (c.code || "").trim(),
      title: c.title || c.description || "",
      link: c.affiliate_link || c.url || "",
      validTo: c.valid_to || null,
    });
  }
  for (const c of cjAll as any[]) {
    records.push({
      shopName: c.advertiserName || "",
      domain: "",
      code: (c.code || "").trim(),
      title: c.description || "",
      link: c.link || "",
      validTo: c.endDate || null,
    });
  }

  const affialShopMap = new Map(AFFIAL_SHOPS.map((s) => [s.domain, s.affiliateUrl]));
  for (const c of AFFIAL_COUPONS) {
    records.push({
      shopName: c.shop,
      domain: c.domain,
      code: (c.code || "").trim(),
      title: `${c.discount} zľava`,
      link: affialShopMap.get(c.domain) ?? `https://${c.domain}`,
      validTo: c.expires !== "neomedzená" ? c.expires : null,
    });
  }
  for (const a of STATIC_AKCIE) {
    records.push({
      shopName: a.shopName,
      domain: a.domain,
      code: "",
      title: a.title,
      link: a.affiliateUrl,
      validTo: null,
    });
  }

  return records.filter((r) => notExpired(r.validTo) && (r.code || r.link));
}

/**
 * Postaví index `doména obchodu → {kupón, akcia}` z jedného načítania
 * všetkých zdrojov. Volá sa raz pre celú sadu produktov v jednom hľadaní.
 */
export async function buildShopOffersIndex(
  domains: string[]
): Promise<Map<string, ShopOffer>> {
  const uniqueDomains = [...new Set(domains.filter(Boolean).map((d) => d.toLowerCase()))];
  const index = new Map<string, ShopOffer>();
  if (uniqueDomains.length === 0) return index;

  let records: OfferRecord[];
  try {
    records = await loadOfferRecords();
  } catch {
    return index;
  }

  for (const domain of uniqueDomains) {
    const matches = createShopMatcher(domain);
    let coupon: ShopCoupon | null = null;
    let deal: ShopDeal | null = null;
    for (const r of records) {
      if (!matches(r.shopName, r.domain)) continue;
      if (r.code && !coupon && r.link) {
        coupon = { code: r.code, title: r.title, link: r.link };
      } else if (!r.code && !deal && r.link) {
        deal = { title: r.title, link: r.link };
      }
      if (coupon && deal) break;
    }
    if (coupon || deal) index.set(domain, { coupon, deal });
  }

  return index;
}

/** Index `presná doména → {kupón, akcia}` pre ponuky na produktovom detaile. */
export async function getOffersByExactDomain(
  domains: string[]
): Promise<Map<string, ExactDomainOffer>> {
  if (domains.length === 0) return new Map();
  try {
    return buildOffersByExactDomain(await loadOfferRecords(), domains);
  } catch {
    return new Map();
  }
}
