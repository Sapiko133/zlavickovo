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

export function getProductOutboundUrl(product: ProductOutboundInput): string {
  const affiliateUrl = product.affiliate_url || product.affiliateUrl;
  if (affiliateUrl) return affiliateUrl;

  const query = (product.ean || product.name || "").trim();
  return buildServerHeurekaSearchUrl(query);
}
