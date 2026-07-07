import { searchHkProducts, toProductSlug, formatPrice, formatAmount } from "@/lib/heureka/query";
import { feedManager } from "@/lib/feeds/FeedManager";
import { buildShopOffersIndex } from "@/lib/shop-offers";
import { normalizeSearchText } from "@/lib/search-normalize";

export const dynamic = "force-dynamic";

interface ProductResult {
  name: string;
  description: string;
  url: string;          // interná stránka produktu (Heureka) alebo odkaz obchodu
  affiliateUrl: string; // trackovaný odkaz na nákup
  domain: string;
  price: string;        // formátovaná cena (napr. "12,99 €")
  priceNum: number | null;
  imgUrl: string;
  source: string;
  coupon: { code: string; title: string; link: string } | null;
  deal: { title: string; link: string } | null;
}

// Cena z feedu je string ("12,99 EUR", "1 299 Kč"...) — vytiahni číslo pre radenie
function parsePriceNum(price?: string | null): number | null {
  if (!price) return null;
  const n = parseFloat(String(price).replace(/[^\d.,]/g, "").replace(/\s/g, "").replace(",", "."));
  return isNaN(n) || n <= 0 ? null : n;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  if (!q.trim()) return Response.json([]);

  try {
    const [hkRes, feedRes] = await Promise.allSettled([
      searchHkProducts(q, 20),
      feedManager.search(q),
    ]);

    const merged: ProductResult[] = [];
    const seen = new Set<string>();
    const keyOf = (name: string, domain: string) =>
      `${normalizeSearchText(name)}|${(domain || "").toLowerCase()}`;

    // Heureka má prioritu — má vlastnú detailnú stránku produktu
    if (hkRes.status === "fulfilled") {
      for (const p of hkRes.value) {
        const key = keyOf(p.name, p.domain);
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push({
          name: p.name,
          description: p.description ?? "",
          url: `/produkt/${toProductSlug(p.name, p.id)}`,
          affiliateUrl: p.affiliate_url || p.url,
          domain: p.domain,
          price: formatPrice(p.price, p.domain),
          priceNum: parsePriceNum(p.price),
          imgUrl: p.img_url,
          source: "heureka",
          coupon: null,
          deal: null,
        });
      }
    }

    // Feedové produkty (Dognet/Affial/eHub/CJ) — bez internej stránky, odkaz do obchodu
    if (feedRes.status === "fulfilled") {
      for (const p of feedRes.value) {
        const key = keyOf(p.name, p.domain);
        if (seen.has(key)) continue;
        seen.add(key);
        const priceNum = parsePriceNum(p.price);
        merged.push({
          name: p.name,
          description: p.description ?? "",
          url: p.affiliateUrl || p.url,
          affiliateUrl: p.affiliateUrl || p.url,
          domain: p.domain,
          price: priceNum !== null ? formatAmount(priceNum, p.domain) : (p.price || ""),
          priceNum,
          imgUrl: p.imgUrl,
          source: p.source,
          coupon: null,
          deal: null,
        });
      }
    }

    // Kupón / akcia obchodu k jednotlivým produktom (jeden index pre celú sadu)
    try {
      const offers = await buildShopOffersIndex(merged.map((p) => p.domain));
      for (const p of merged) {
        const o = offers.get((p.domain || "").toLowerCase());
        if (o) {
          p.coupon = o.coupon;
          p.deal = o.deal;
        }
      }
    } catch {}

    // Zoradenie podľa ceny vzostupne — produkty bez ceny na koniec
    merged.sort((a, b) => {
      if (a.priceNum === null && b.priceNum === null) return 0;
      if (a.priceNum === null) return 1;
      if (b.priceNum === null) return -1;
      return a.priceNum - b.priceNum;
    });

    return Response.json(merged.slice(0, 30));
  } catch {
    return Response.json([]);
  }
}
