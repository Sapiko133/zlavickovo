import { getCoupons as getDognetCoupons } from "@/lib/dognet";
import { getAffialCoupons } from "@/lib/affial";
import { getEhubCoupons } from "@/lib/ehub";
import { getCjCoupons } from "@/lib/cj";
import { AFFIAL_COUPONS } from "@/lib/affial-coupons";
import { AFFIAL_SHOPS } from "@/lib/affial-shops";
import { STATIC_AKCIE } from "@/lib/akcie";
import { getShopDomain } from "@/lib/shop-domains";
import { normalizeShopSlug } from "@/lib/slug";
import { isOfferActive } from "@/lib/offers/freshness";

export type AffiliateActionSource = "dognet" | "affial" | "ehub" | "cj" | "static";

export interface AffiliateAction {
  actionKey: string;
  articleSlug: string;
  source: AffiliateActionSource;
  sourceId: string;
  shopName: string;
  shopSlug: string;
  domain: string;
  title: string;
  description: string;
  affiliateUrl: string;
  validTo: string | null;
  discountPct: number | null;
}

interface RawAction {
  id: string | number;
  source: AffiliateActionSource;
  shopName: string;
  title: string;
  description?: string | null;
  code?: string | null;
  affiliateUrl: string;
  validTo?: string | null;
  domain?: string | null;
}

interface DognetAction {
  id: string | number;
  title?: string;
  name?: string;
  description?: string;
  code?: string;
  affiliate_link?: string;
  url?: string;
  valid_to?: string | null;
  campaign?: { name?: string; url?: string };
}

function cleanDomain(value: string): string {
  return value.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/.*$/, "").toLowerCase();
}

function extractDiscountPct(text: string): number | null {
  const match = text.match(/(?:až\s*)?-?\s*(\d{1,2})\s*%/i);
  if (!match) return null;
  const value = Number.parseInt(match[1], 10);
  return value >= 1 && value <= 90 ? value : null;
}

/** Kanonický freshness model: neparsovateľný dátum nie je aktívny, SK formát OK. */
function isActive(validTo?: string | null): boolean {
  return isOfferActive(validTo ?? null);
}

/** Krátky stabilný hash bez Node-only závislostí — vhodný aj pre názov URL. */
function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function normalizeAction(raw: RawAction): AffiliateAction | null {
  if (raw.code?.trim()) return null;
  const shopName = String(raw.shopName || "").trim();
  const title = String(raw.title || raw.description || "").trim();
  const affiliateUrl = String(raw.affiliateUrl || "").trim();
  if (!shopName || !title || !affiliateUrl.startsWith("http") || !isActive(raw.validTo)) return null;

  const shopSlug = normalizeShopSlug(shopName);
  if (!shopSlug) return null;
  const sourceId = String(raw.id);
  const actionKey = `${raw.source}:${sourceId}`;
  const domain = cleanDomain(raw.domain || "") || getShopDomain(shopName) || `${shopSlug}.sk`;

  return {
    actionKey,
    articleSlug: `${shopSlug}-akcia-${raw.source}-${stableHash(actionKey)}`,
    source: raw.source,
    sourceId,
    shopName,
    shopSlug,
    domain,
    title,
    description: String(raw.description || "").trim(),
    affiliateUrl,
    validTo: raw.validTo || null,
    discountPct: extractDiscountPct(`${title} ${raw.description || ""}`),
  };
}

/**
 * Jediný zdroj aktuálnych akcií bez kupónového kódu pre feed aj článkový cron.
 * Vďaka spoločnému actionKey má každá ponuka vlastný stabilný detail článku.
 */
export async function getAffiliateActions(): Promise<AffiliateAction[]> {
  const [dognet, affial, ehub, cj] = await Promise.all([
    getDognetCoupons().catch(() => []),
    getAffialCoupons().catch(() => []),
    getEhubCoupons().catch(() => []),
    getCjCoupons().catch(() => []),
  ]);
  const affialLinks = new Map(AFFIAL_SHOPS.map((shop) => [shop.domain.toLowerCase(), shop.affiliateUrl]));

  const raw: RawAction[] = [
    ...(dognet as DognetAction[]).map((item) => ({
      id: item.id,
      source: "dognet" as const,
      shopName: item.campaign?.name || "",
      title: item.title || item.name || item.description || "",
      description: item.description,
      code: item.code,
      affiliateUrl: item.affiliate_link || item.url || "",
      validTo: item.valid_to,
      domain: item.campaign?.url,
    })),
    ...affial.map((item) => ({
      id: item.id,
      source: "affial" as const,
      shopName: item.campaign_name,
      title: item.title || item.description,
      description: item.description,
      code: item.code,
      affiliateUrl: item.affiliate_link,
      validTo: item.valid_to,
    })),
    ...ehub.map((item) => ({
      id: item.id,
      source: "ehub" as const,
      shopName: item.campaign_name,
      title: item.title || item.description,
      description: item.description,
      code: item.code,
      affiliateUrl: item.affiliate_link,
      validTo: item.valid_to,
    })),
    ...cj.map((item) => ({
      id: item.id,
      source: "cj" as const,
      shopName: item.advertiserName,
      title: item.description,
      description: item.description,
      code: item.code,
      affiliateUrl: item.link,
      validTo: item.endDate,
    })),
    ...AFFIAL_COUPONS.map((item, index) => ({
      id: `${item.domain}-${index}`,
      source: "affial" as const,
      shopName: item.shop,
      title: `${item.discount} zľava`,
      description: `${item.discount} zľava v obchode ${item.shop}`,
      code: item.code,
      affiliateUrl: affialLinks.get(item.domain.toLowerCase()) || `https://${item.domain}`,
      domain: item.domain,
    })),
    ...STATIC_AKCIE.map((item) => ({
      id: item.id,
      source: "static" as const,
      shopName: item.shopName,
      title: item.title,
      description: item.description,
      affiliateUrl: item.affiliateUrl,
      validTo: item.validTo,
      domain: item.domain,
    })),
  ];

  const unique = new Map<string, AffiliateAction>();
  for (const item of raw) {
    const action = normalizeAction(item);
    if (action) unique.set(action.actionKey, action);
  }
  return Array.from(unique.values());
}
