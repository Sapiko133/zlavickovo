/**
 * SEO index obchodov — pre každý obchod z registra spočíta aktívne ponuky
 * a rozhodne indexáciu. Používa rovnaký kód ako stránka obchodu
 * (collectShopOffers + isShopOfferActive + shopIndexDecision), takže sitemap
 * a meta robots sa nemôžu rozísť.
 *
 * Výpočet je čisto v pamäti nad raz načítanými zdrojmi (žiadne N+1),
 * výsledok sa cachuje v Redis (1 h) — sitemap ani dashboard ho nepočítajú pri každom hite.
 */
import { collectShopOffers, loadShopOfferSources } from "@/lib/dognet";
import { getAllArticles, type Article } from "@/lib/articles";
import { redis } from "@/lib/redis";
import { getShopRegistry, resolveShopSlugSync, type ShopRegistry } from "./shop-registry";
import { duplicateArticleCanonicals, isArticleIndexable, isShopOfferActive, shopIndexDecision } from "./indexing";

export interface ShopSeoStat {
  slug: string;
  name: string;
  categoryId: string | null;
  activeCodes: number;
  activeDeals: number;
  activeArticles: number;
  index: boolean;
  reason: string;
}

const CACHE_KEY = "seo:shop-index:v1";
const CACHE_TTL = 3600;

/** Meno, ktorým stránka obchodu hľadá ponuky (musí byť zhodné s app/kupony/[slug]). */
export function shopLookupName(slug: string): string {
  return slug.replace(/-/g, " ");
}

/** Aktívne sale články podľa kanonického slugu obchodu (bez duplikátov — tie majú canonical na originál). */
export function articlesByShop(articles: Article[], reg: ShopRegistry): Map<string, Article[]> {
  const out = new Map<string, Article[]>();
  const dup = duplicateArticleCanonicals(articles.filter((a) => a.published));
  for (const a of articles) {
    if (a.type !== "sale" || !isArticleIndexable(a) || dup.has(a.slug)) continue;
    const slug = resolveShopSlugSync(reg, { slug: a.shopSlug, name: a.shopName, domain: a.domain });
    if (!slug) continue;
    out.set(slug, [...(out.get(slug) ?? []), a]);
  }
  return out;
}

async function compute(): Promise<ShopSeoStat[]> {
  const [reg, sources, articles] = await Promise.all([
    getShopRegistry(),
    loadShopOfferSources(),
    getAllArticles().catch(() => [] as Article[]),
  ]);
  const byShop = articlesByShop(articles, reg);
  const out: ShopSeoStat[] = [];
  for (const e of reg.bySlug.values()) {
    const offers = collectShopOffers(shopLookupName(e.slug), sources).filter(isShopOfferActive);
    const activeCodes = offers.filter((c: any) => c.code && String(c.code).trim() !== "").length;
    const activeDeals = offers.length - activeCodes;
    const activeArticles = byShop.get(e.slug)?.length ?? 0;
    const d = shopIndexDecision({ slug: e.slug, activeOffers: offers.length + activeArticles });
    out.push({
      slug: e.slug, name: e.name, categoryId: e.categoryId ?? null,
      activeCodes, activeDeals, activeArticles, index: d.index, reason: d.reason,
    });
  }
  return out.sort((a, b) => a.slug.localeCompare(b.slug));
}

let memo: { at: number; data: Promise<ShopSeoStat[]> } | null = null;

export async function getShopSeoIndex(opts: { fresh?: boolean } = {}): Promise<ShopSeoStat[]> {
  if (!opts.fresh) {
    if (memo && Date.now() - memo.at < 10 * 60 * 1000) return memo.data;
    try {
      const cached = await redis.get<ShopSeoStat[]>(CACHE_KEY);
      if (Array.isArray(cached) && cached.length > 0) {
        memo = { at: Date.now(), data: Promise.resolve(cached) };
        return cached;
      }
    } catch {}
  }
  const data = compute();
  memo = { at: Date.now(), data };
  data.then(
    (d) => { if (d.length > 0) redis.set(CACHE_KEY, d, { ex: CACHE_TTL }).catch(() => {}); },
    () => { memo = null; },
  );
  return data;
}
