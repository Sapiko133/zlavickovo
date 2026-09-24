/**
 * SEO index obchodov — pre každý obchod z registra spočíta aktívne ponuky
 * a rozhodne indexáciu. Používa rovnaký kód ako stránka obchodu
 * (collectShopOffers + isShopOfferActive + shopIndexDecision), takže sitemap
 * a meta robots sa nemôžu rozísť.
 *
 * Výpočet je čisto v pamäti nad raz načítanými zdrojmi (žiadne N+1),
 * výsledok sa cachuje v Redis (6 h, tick ho obnoví po zmene dát) — sitemap ani
 * dashboard ho nepočítajú pri každom hite.
 */
import { collectShopOffers, loadShopOfferSources } from "@/lib/dognet";
import { getAllArticles, type Article } from "@/lib/articles";
import { redis } from "@/lib/redis";
import { isAdultShop } from "@/lib/shop-categories";
import { getShopRegistry, isRegistryDegraded, resolveShopSlugSync, type ShopRegistry } from "./shop-registry";
import { duplicateArticleCanonicals, isArticleIndexable, isShopOfferActive, shopIndexDecision } from "./indexing";

export interface ShopSeoStat {
  slug: string;
  name: string;
  categoryId: string | null;
  activeCodes: number;
  activeDeals: number;
  activeArticles: number;
  /** Outbound kliky + interné vyhľadávania značky (all-time). */
  demandEvents: number;
  lastOfferAt: string | null;
  index: boolean;
  reason: string;
}

const CACHE_KEY = "seo:shop-index:v2";
/** Hash slug → ISO čas poslednej aktívnej ponuky (trvalý, pre anti-flapping grace). */
const LAST_OFFER_KEY = "seo:shop-last-offer";

/** Dopyt po značke z vlastných dát webu: outbound kliky (all-time) + interné vyhľadávania. */
async function loadDemand(reg: ShopRegistry, slugs: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  try {
    for (let i = 0; i < slugs.length; i += 200) {
      const chunk = slugs.slice(i, i + 200);
      const vals = (await redis.mget<(number | null)[]>(...chunk.map((s) => `click:outbound:shop:${s}`))) ?? [];
      chunk.forEach((s, j) => { const n = Number(vals[j]) || 0; if (n) out.set(s, n); });
    }
  } catch {}
  try {
    const flat = (await redis.zrange("search:log:all", 0, -1, { withScores: true })) as unknown[];
    for (let i = 0; i + 1 < flat.length; i += 2) {
      const slug = resolveShopSlugSync(reg, { name: String(flat[i]) });
      if (slug) out.set(slug, (out.get(slug) ?? 0) + (Number(flat[i + 1]) || 0));
    }
  } catch {}
  return out;
}
// Automatizačný tick (lib/automation/tick.ts) index prepočíta hneď po zmene feedov
// alebo článkov (getShopSeoIndex({ fresh: true })), preto netreba krátke TTL —
// cache miss by inak spúšťal ťažký výpočet počas requestu návštevníka.
const CACHE_TTL = 6 * 3600;

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
  if (isRegistryDegraded(reg)) throw new Error(`SEO index: degradovaný register (${reg.bySlug.size} obchodov)`);
  if (sources.dognet.length === 0 && sources.ehub.length === 0) throw new Error("SEO index: zdroje ponúk sú prázdne");
  const byShop = articlesByShop(articles, reg);
  const slugs = [...reg.bySlug.keys()];
  const [demand, lastOffer] = await Promise.all([
    loadDemand(reg, slugs),
    redis.hgetall<Record<string, string>>(LAST_OFFER_KEY).catch(() => null),
  ]);
  const nowIso = new Date().toISOString();
  const touched: Record<string, string> = {};
  const out: ShopSeoStat[] = [];
  for (const e of reg.bySlug.values()) {
    const offers = collectShopOffers(shopLookupName(e.slug), sources).filter(isShopOfferActive);
    const activeCodes = offers.filter((c: any) => c.code && String(c.code).trim() !== "").length;
    const activeDeals = offers.length - activeCodes;
    const activeArticles = byShop.get(e.slug)?.length ?? 0;
    const total = offers.length + activeArticles;
    if (total > 0) touched[e.slug] = nowIso;
    const lastOfferAt = total > 0 ? nowIso : (lastOffer?.[e.slug] ?? null);
    const demandEvents = demand.get(e.slug) ?? 0;
    const d = shopIndexDecision({
      slug: e.slug, activeOffers: total, lastOfferAt, demandEvents,
      isAdult: isAdultShop({ slug: e.slug, name: e.name, domain: e.domain }),
    });
    out.push({
      slug: e.slug, name: e.name, categoryId: e.categoryId ?? null,
      activeCodes, activeDeals, activeArticles, demandEvents, lastOfferAt,
      index: d.index, reason: d.reason,
    });
  }
  if (Object.keys(touched).length > 0) await redis.hset(LAST_OFFER_KEY, touched).catch(() => {});
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
