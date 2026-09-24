/**
 * Obchody kategórie — zdieľané stránkou /kategoria/[id] aj sitemap/indexačnou
 * politikou. Zdroje: kurátorské featuredShops + Affial partneri kategórie +
 * SEO index (obchody kategórie s aktívnou ponukou). Každý slug je overený
 * registrom (žiadne odkazy na 404) a deduplikovaný podľa kanonickej entity.
 */
import { AFFIAL_SHOPS } from "@/lib/affial-shops";
import { getShopDomain } from "@/lib/shop-domains";
import { compareShopsByPriority } from "@/lib/shop-priority";
import { normalizeShopName, normalizeShopSlug } from "@/lib/slug";
import type { TaxonomyCategory } from "@/lib/taxonomy";
import { resolveShopSlugSync, type ShopRegistry } from "./shop-registry";
import type { ShopSeoStat } from "./shop-index";

export interface CategoryShop {
  slug: string;
  name: string;
  domain: string;
  /** Aktívne ponuky (kódy + akcie + články) zo SEO indexu. */
  offers: number;
}

export function buildCategoryShops(cat: TaxonomyCategory, reg: ShopRegistry, index: ShopSeoStat[], limit = 48): CategoryShop[] {
  const statBySlug = new Map(index.map((s) => [s.slug, s]));
  const offersOf = (slug: string) => {
    const st = statBySlug.get(slug);
    return st ? st.activeCodes + st.activeDeals + st.activeArticles : 0;
  };

  const shops = new Map<string, CategoryShop>();
  const addShop = (input: { slug?: string; name: string; domain?: string }) => {
    const resolved = resolveShopSlugSync(reg, input);
    if (!resolved || shops.has(resolved)) return;
    const entry = reg.bySlug.get(resolved);
    shops.set(resolved, {
      slug: resolved,
      name: entry?.name ?? input.name,
      domain: getShopDomain(input.name) || input.domain || entry?.domain || `${resolved}.sk`,
      offers: offersOf(resolved),
    });
  };

  // .sk → .cz → ostatné; normalizeShopName dedupe kurátorských mutácií
  const seenKeys = new Set<string>();
  for (const f of [...cat.featuredShops].sort(compareShopsByPriority)) {
    const key = normalizeShopName(f.name) || f.slug;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    addShop({ slug: f.href?.startsWith("/kupony/") ? f.href.slice(8) : f.slug, name: f.name });
  }
  for (const a of AFFIAL_SHOPS.filter((s) => s.category === cat.id).sort(compareShopsByPriority)) {
    addShop({ slug: normalizeShopSlug(a.domain), name: a.name, domain: a.domain });
  }
  for (const st of index) {
    if (st.categoryId === cat.id && st.index && offersOf(st.slug) > 0) addShop({ slug: st.slug, name: st.name });
  }
  return [...shops.values()]
    .sort((a, b) => b.offers - a.offers || compareShopsByPriority(a, b))
    .slice(0, limit);
}
