/**
 * Jednotný monetizačný resolver nad kanonickou ponukou (jediný zdroj pravdy).
 *
 * Priorita (PROJECT_VISION §9):
 *   1. priamy affiliate link ponuky (deep link siete),
 *   2. shop-level affiliate link (raz vyriešený per obchod – bez N+1),
 *   3. neplatený priamy odkaz (posledná záchrana, stránka nesmie zostať bez CTA).
 *
 * ŽIADNY Heureka fallback (Heureka je z projektu odstránená). Resolver vyberá iba
 * OUTBOUND CESTU – cenu ani poradie ponúk nemení; lepšia provízia neprepíše
 * najlepšiu ponuku.
 */

export type OfferOutboundKind = "shop_affiliate" | "direct_unmonetized";

export interface OfferOutbound {
  url: string;
  kind: OfferOutboundKind;
  monetized: boolean;
}

export interface ResolveOfferInput {
  /** Priamy affiliate/deep link konkrétnej ponuky. */
  affiliateUrl?: string | null;
  /** Shop-level affiliate link (getShopAffiliateUrl), vyriešený raz per obchod. */
  shopAffiliateUrl?: string | null;
  /** Surová cieľová URL (neplatený fallback). */
  url?: string | null;
}

function cleanHttpUrl(value?: string | null): string | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? trimmed : null;
  } catch {
    return null;
  }
}

export function resolveOfferOutbound(offer: ResolveOfferInput): OfferOutbound | null {
  // 1. priamy affiliate ponuky
  const direct = cleanHttpUrl(offer.affiliateUrl);
  if (direct) return { url: direct, kind: "shop_affiliate", monetized: true };

  // 2. shop-level affiliate
  const shop = cleanHttpUrl(offer.shopAffiliateUrl);
  if (shop) return { url: shop, kind: "shop_affiliate", monetized: true };

  // 3. neplatený priamy odkaz
  const raw = cleanHttpUrl(offer.url);
  if (raw) return { url: raw, kind: "direct_unmonetized", monetized: false };

  // Bez žiadneho platného odkazu nemáme kam poslať používateľa.
  return null;
}
