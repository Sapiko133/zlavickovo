type ProductOutboundInput = {
  affiliate_url?: string | null;
  affiliateUrl?: string | null;
  ean?: string | null;
  name?: string | null;
};

import {
  buildHeurekaSearchUrl,
  buildHeurekaUrl,
  cleanHeurekaAffiliateId,
  type HeurekaUrlOptions,
} from "./affiliate-url";

export { buildHeurekaSearchUrl, buildHeurekaUrl };

const MISSING_HAFF_MESSAGE =
  "Heureka affiliate monetization is not active because HEUREKA_HAFF_ID is not set.";

let warnedMissingHaffId = false;

function warnMissingHaffId() {
  if (warnedMissingHaffId) return;
  warnedMissingHaffId = true;

  if (process.env.NODE_ENV === "production") {
    console.error(MISSING_HAFF_MESSAGE);
    return;
  }

  console.warn(`${MISSING_HAFF_MESSAGE} Set HEUREKA_HAFF_ID to enable Heureka affiliate links.`);
}

export function getHeurekaHaffId(): string | undefined {
  const affiliateId = cleanHeurekaAffiliateId(process.env.HEUREKA_HAFF_ID);
  if (!affiliateId) warnMissingHaffId();
  return affiliateId;
}

function resolveHeurekaHaffId(options?: HeurekaUrlOptions): string | undefined {
  if (options && Object.prototype.hasOwnProperty.call(options, "affiliateId")) {
    return cleanHeurekaAffiliateId(options.affiliateId);
  }

  return getHeurekaHaffId();
}

export function buildServerHeurekaUrl(destinationUrl?: string, options?: HeurekaUrlOptions): string {
  const affiliateId = resolveHeurekaHaffId(options);
  return buildHeurekaUrl(destinationUrl, { affiliateId });
}

export function buildServerHeurekaSearchUrl(query: string, options?: HeurekaUrlOptions): string {
  const affiliateId = resolveHeurekaHaffId(options);
  return buildHeurekaSearchUrl(query, { affiliateId });
}

/** Tenký wrapper nad getOfferOutbound pre vrstvy, ktoré potrebujú iba URL. */
export function getProductOutboundUrl(product: ProductOutboundInput): string {
  return getOfferOutbound(product).url;
}

export type OfferOutboundKind = "shop_affiliate" | "heureka_fallback" | "direct_unmonetized";

export type OfferOutbound = {
  url: string;
  kind: OfferOutboundKind;
  monetized: boolean;
};

type OfferOutboundInput = ProductOutboundInput & {
  url?: string | null;
};

function cleanHttpUrl(value?: string | null): string | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return trimmed;
  } catch {
    return null;
  }
}

/**
 * Outbound URL odporúčanej ponuky vrátane typu monetizácie (pre CTA text a tracking).
 * Priorita (PROJECT_VISION §12–13):
 * 1. platný priamy affiliate link ponuky (deep linky sietí sa stavajú pri importe feedu),
 * 2. Heureka affiliate fallback s haff (len ak je HEUREKA_HAFF_ID nastavené — bez env
 *    sa odkaz nesmie tváriť ako monetizovaný),
 * 3. nemonetizovaný priamy link na produkt,
 * 4. posledná záchrana: Heureka vyhľadávanie bez haff — stránka nesmie zostať bez CTA.
 */
export function getOfferOutbound(offer: OfferOutboundInput): OfferOutbound {
  const affiliateUrl = cleanHttpUrl(offer.affiliate_url ?? offer.affiliateUrl);
  if (affiliateUrl) return { url: affiliateUrl, kind: "shop_affiliate", monetized: true };

  const query = (offer.ean || offer.name || "").trim();
  if (getHeurekaHaffId()) {
    return { url: buildServerHeurekaSearchUrl(query), kind: "heureka_fallback", monetized: true };
  }

  const directUrl = cleanHttpUrl(offer.url);
  if (directUrl) return { url: directUrl, kind: "direct_unmonetized", monetized: false };

  return { url: buildServerHeurekaSearchUrl(query), kind: "direct_unmonetized", monetized: false };
}
