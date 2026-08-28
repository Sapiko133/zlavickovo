/**
 * Jednotný monetizačný resolver nad kanonickou ponukou (úloha 7).
 *
 * Priorita (PROJECT_VISION §12–13, master §6):
 *   1. priamy affiliate link ponuky (deep link siete z importu feedu),
 *   2. shop-level affiliate link (raz vyriešený per obchod – bez N+1),
 *   3. Heureka affiliate fallback (len s HEUREKA_HAFF_ID),
 *   4. neplatený priamy odkaz (posledná záchrana, stránka nesmie zostať bez CTA).
 *
 * DÔLEŽITÉ: resolver vyberá iba OUTBOUND CESTU. Cenu ani poradie ponúk NEmení –
 * lepšia provízia nikdy nesmie prepísať najnižšiu dôveryhodnú ponuku (audit §6).
 * Delegovaním na getOfferOutbound zostáva Heureka/direct chvost jediným zdrojom pravdy.
 */

import { getOfferOutbound, type OfferOutbound } from "@/lib/heureka/affiliate";

export type { OfferOutbound, OfferOutboundKind } from "@/lib/heureka/affiliate";

export interface ResolveOfferInput {
  /** Priamy affiliate/deep link konkrétnej ponuky. */
  affiliateUrl?: string | null;
  /** Shop-level affiliate link (getShopAffiliateUrl), vyriešený raz per obchod. */
  shopAffiliateUrl?: string | null;
  /** Surová cieľová URL (neplatený fallback). */
  url?: string | null;
  /** Identita pre Heureka fallback vyhľadávanie. */
  ean?: string | null;
  name?: string | null;
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

export function resolveOfferOutbound(offer: ResolveOfferInput): OfferOutbound {
  // 1. priamy affiliate ponuky
  const direct = cleanHttpUrl(offer.affiliateUrl);
  if (direct) return { url: direct, kind: "shop_affiliate", monetized: true };

  // 2. shop-level affiliate
  const shop = cleanHttpUrl(offer.shopAffiliateUrl);
  if (shop) return { url: shop, kind: "shop_affiliate", monetized: true };

  // 3. + 4. Heureka fallback → neplatený priamy odkaz (jediný zdroj pravdy).
  return getOfferOutbound({ url: offer.url, ean: offer.ean, name: offer.name });
}
