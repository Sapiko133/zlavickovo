import { searchHkProducts, toProductSlug, formatPrice, formatAmount } from "@/lib/heureka/query";
import { getProductOutboundUrl } from "@/lib/heureka/affiliate";
import { feedManager } from "@/lib/feeds/FeedManager";
import { buildShopOffersIndex } from "@/lib/shop-offers";
import { normalizeSearchText } from "@/lib/search-normalize";
import { logSearchQuery } from "@/lib/search-log";

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

// Zhoda tokenu v texte — presná alebo cez stem-prefix (rieši SK/CZ morfológiu bez
// stemmera: "vitaminy" → "vitami" chytí "multivitamín"; krátke tokeny len presne,
// aby nevznikali false positives).
function textHasToken(hay: string, token: string): boolean {
  if (!token) return false;
  if (hay.includes(token)) return true;
  if (token.length >= 7) {
    const stem = token.slice(0, token.length - 2);
    return stem.length >= 5 && hay.includes(stem);
  }
  return false;
}

// Relevancia produktu voči dopytu. Zhoda v NÁZVE (45–100) vždy prebije zhodu len
// v POPISE (12–25). Cena sa NEpoužíva — je len sekundárne kritérium pri radení.
function relevanceScore(name: string, description: string, q: string): number {
  const nq = normalizeSearchText(q);
  if (!nq) return 0;
  const tokens = nq.split(" ").filter(Boolean);
  const nName = normalizeSearchText(name);
  const nDesc = normalizeSearchText(description);

  if (nName === nq) return 100;
  if (nName.startsWith(nq + " ")) return 92;
  if ((" " + nName + " ").includes(" " + nq + " ")) return 85; // fráza na hranici slov
  if (nName.includes(nq)) return 75;                            // fráza ako substring v názve
  const inName = tokens.filter((t) => textHasToken(nName, t)).length;
  if (tokens.length > 0 && inName === tokens.length) return 60; // všetky tokeny v názve
  if (inName > 0) return 45;                                    // časť tokenov v názve
  const inDesc = tokens.filter((t) => textHasToken(nDesc, t)).length;
  if (tokens.length > 0 && inDesc === tokens.length) return 25; // len v popise
  if (inDesc > 0) return 12;
  return 0;
}

// Základný názov bez size-sufixu — zoskupí varianty toho istého produktu
// ("... Velikost: 42" / "... veľkosť 90x200"). Modelové čísla (iPhone 15 vs 16)
// zostávajú, kolabujú sa len veľkosti.
function variantBaseKey(name: string): string {
  const n = normalizeSearchText(name);
  return n.replace(/\b(velkost|velikost|size|vel)\b.*$/, "").trim() || n;
}

// Cena vzostupne, null (bez ceny) na koniec.
function priceAsc(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  if (!q.trim()) return Response.json([]);

  // Zaloguj dopyt (fire-and-forget). Dedup v logSearchQuery zabráni dvojitému
  // započítaniu — /hladat volá feed-search aj search-v2 pre ten istý dopyt naraz.
  void logSearchQuery(q);

  try {
    const [hkRes, feedRes] = await Promise.allSettled([
      searchHkProducts(q, 60), // väčší kandidátsky pool → lepšia diverzita po cappingu
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
          affiliateUrl: getProductOutboundUrl(p),
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

    // ── Relevancia (primárna, drží sa mimo objektu, aby nešpinila odpoveď) ──
    const score = new Map<ProductResult, number>();
    for (const p of merged) score.set(p, relevanceScore(p.name, p.description, q));

    // ── Potlačenie variantov — rovnaký produkt vo viac veľkostiach v tom istom
    // obchode zoskupíme na jeden (najrelevantnejší, pri zhode najlacnejší) ──
    const bestByVariant = new Map<string, ProductResult>();
    for (const p of merged) {
      const key = `${(p.domain || "").toLowerCase()}|${variantBaseKey(p.name)}`;
      const cur = bestByVariant.get(key);
      if (!cur) { bestByVariant.set(key, p); continue; }
      const ps = score.get(p) ?? 0, cs = score.get(cur) ?? 0;
      if (ps > cs || (ps === cs && priceAsc(p.priceNum, cur.priceNum) < 0)) {
        bestByVariant.set(key, p);
      }
    }
    const collapsed = [...bestByVariant.values()];

    // ── Kupón / akcia obchodu k jednotlivým produktom (jeden index pre sadu) ──
    try {
      const offers = await buildShopOffersIndex(collapsed.map((p) => p.domain));
      for (const p of collapsed) {
        const o = offers.get((p.domain || "").toLowerCase());
        if (o) { p.coupon = o.coupon; p.deal = o.deal; }
      }
    } catch {}

    // ── Radenie: relevancia DESC, cena ASC len ako sekundárne kritérium ──
    collapsed.sort((a, b) => {
      const sa = score.get(a) ?? 0, sb = score.get(b) ?? 0;
      if (sb !== sa) return sb - sa;
      return priceAsc(a.priceNum, b.priceNum);
    });

    // ── Obmedzenie dominancie domény — max 3 na doménu v hornej časti, zvyšok
    // sa presunie na koniec (neztratí sa, len neupchá top výsledky) ──
    const PER_DOMAIN_CAP = 3;
    const domainCount: Record<string, number> = {};
    const head: ProductResult[] = [];
    const tail: ProductResult[] = [];
    for (const p of collapsed) {
      const d = (p.domain || "").toLowerCase();
      if ((domainCount[d] ?? 0) < PER_DOMAIN_CAP) {
        domainCount[d] = (domainCount[d] ?? 0) + 1;
        head.push(p);
      } else {
        tail.push(p);
      }
    }

    return Response.json([...head, ...tail].slice(0, 30));
  } catch {
    return Response.json([]);
  }
}
