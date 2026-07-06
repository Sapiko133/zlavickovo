import { XMLParser } from "fast-xml-parser";
import { unstable_cache } from "next/cache";
import { AFFIAL_SHOPS, buildAffialTrackingUrl } from "@/lib/affial-shops";

const affialShopByDomain = new Map(AFFIAL_SHOPS.map(s => [s.domain.toLowerCase(), s.affiliateUrl]));

async function fetchAffialCoupons() {
  try {
    const res = await fetch("https://www.affial.com/kupony_feed.xml", {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
    const result = parser.parse(xml);

    const raw =
      result?.coupons?.coupon ||
      result?.feed?.item ||
      result?.rss?.channel?.item ||
      result?.items?.item ||
      [];
    const arr: any[] = Array.isArray(raw) ? raw : [raw];

    return arr
      .filter((item: any) => item && typeof item === "object")
      .map((item: any, i: number) => {
        const offerDomain = (item.offerName ?? "").toLowerCase();
        // Feed url je holá URL obchodu bez trackingu → obalíme ju account-level PAP
        // trackerom, aby KAŽDÝ Affial kupón bol monetizovaný (nie len tie v AFFIAL_SHOPS).
        const feedUrl = typeof item.url === "string" ? item.url : "";
        const trackingUrl =
          affialShopByDomain.get(offerDomain) ??
          (feedUrl.startsWith("http") ? buildAffialTrackingUrl(feedUrl) : null) ??
          item.affiliate_url ??
          item.link ??
          item.url ??
          "#";
        return {
          id: `affial-${item.id ?? item.coupon_id ?? i}`,
          title: item.title ?? item.name ?? "",
          code: item.code ?? item.coupon_code ?? "",
          discount: item.discount ?? item.value ?? "",
          description: item.description ?? "",
          campaign_name: item.offerName ?? item.shop_name ?? item.merchant_name ?? item.campaign_name ?? "",
          affiliate_link: trackingUrl,
          valid_to: item.validTill ?? item.validTo ?? item.valid_to ?? item.expiry_date ?? null,
          type: 1,
          source: "affial" as const,
        };
      });
  } catch {
    return [];
  }
}

export const getAffialCoupons = unstable_cache(
  fetchAffialCoupons,
  ["affial-coupons"],
  { revalidate: 3600 },
);
