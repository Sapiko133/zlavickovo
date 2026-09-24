/**
 * Dáta pre Operations dashboard (/admin/ops, /api/admin/ops). Iba číta —
 * SEO čísla berie z existujúcej SEO vrstvy (getSeoInventory, shop index,
 * buildCategoryShops), nepočíta vlastnú paralelnú logiku.
 */
import { getAllArticles, type Article } from "@/lib/articles";
import { FEED_SOURCES } from "@/lib/feeds/sources";
import { loadAllFeedMeta, type FeedMeta, type FeedTier } from "@/lib/feeds/engine";
import { getLastJobRuns, getRecentJobRuns, type JobRun } from "@/lib/jobs/log";
import { getActiveAlerts, getResolvedAlerts, type ActiveAlert } from "@/lib/ops/alerts";
import { getLinkHealthMap, type LinkHealth } from "@/lib/links/health";
import { getFacebookOverview } from "@/lib/social/facebook";
import { articleLifecycle, duplicateArticleCanonicals } from "@/lib/seo/indexing";
import { getSeoInventory, type SeoInventory } from "@/lib/seo/health";
import { getShopSeoIndex } from "@/lib/seo/shop-index";
import { getShopRegistry, resolveShopSlugSync } from "@/lib/seo/shop-registry";
import { buildCategoryShops } from "@/lib/seo/category-shops";
import { TAXONOMY_LIST } from "@/lib/taxonomy";
import { loadShopOfferSources } from "@/lib/dognet";
import { isShopOfferActive } from "@/lib/seo/indexing";

export interface FeedRow extends Partial<FeedMeta> {
  id: string;
  label: string;
  provider: string;
  tier: FeedTier;
  baseIntervalMin: number;
  configured: boolean;
  health: "ok" | "warning" | "error" | "disabled" | "never";
}

export interface OffersSummary {
  articles: { active: number; stale: number; expired: number; removed: number; duplicates: number; total: number; orphans: string[] };
  coupons: Record<string, { total: number; active: number }>;
}

export interface OpsOverview {
  generatedAt: string;
  feeds: FeedRow[];
  offers: OffersSummary;
  facebook: Awaited<ReturnType<typeof getFacebookOverview>> | { error: string };
  seo: (SeoInventory & { shopsWithoutOffers: number; categoriesWithoutOffers: string[] }) | { error: string };
  links: { total: number; ok: number; warn: number; dead: number; deadSample: LinkHealth[] };
  alerts: ActiveAlert[];
  resolvedAlerts: Array<ActiveAlert & { resolvedAt: string }>;
  lastJobs: Record<string, JobRun>;
  recentJobs: JobRun[];
}

function feedHealth(meta: FeedMeta | undefined, configured: boolean): FeedRow["health"] {
  if (!configured) return "disabled";
  if (!meta || meta.status === "never") return "never";
  if (meta.status === "error") return meta.consecutiveErrors >= 3 ? "error" : "warning";
  return meta.status === "warning" ? "warning" : meta.status === "disabled" ? "disabled" : "ok";
}

export function summarizeArticles(articles: Article[], resolveShop: (a: Article) => string | null, now = Date.now()): OffersSummary["articles"] {
  const sale = articles.filter((a) => a.type === "sale");
  const dup = duplicateArticleCanonicals(articles.filter((a) => a.published));
  let active = 0, stale = 0, expired = 0, removed = 0;
  const orphans: string[] = [];
  for (const a of sale) {
    const st = articleLifecycle(a, now).state;
    if (st === "active") {
      if (a.missingSince) stale++;
      else active++;
      if (!dup.has(a.slug) && !resolveShop(a)) orphans.push(`/akcie/${a.slug}`);
    } else if (st === "expired") expired++;
    else removed++;
  }
  return { active, stale, expired, removed, duplicates: dup.size, total: sale.length, orphans: orphans.slice(0, 30) };
}

export async function getOpsOverview(opts: { withSeo?: boolean } = {}): Promise<OpsOverview> {
  const [meta, articles, reg, sources, alerts, resolvedAlerts, lastJobs, recentJobs, linkMap] = await Promise.all([
    loadAllFeedMeta(),
    getAllArticles().catch(() => [] as Article[]),
    getShopRegistry(),
    loadShopOfferSources().catch(() => null),
    getActiveAlerts(),
    getResolvedAlerts(),
    getLastJobRuns(),
    getRecentJobRuns(80),
    getLinkHealthMap(),
  ]);

  const feeds: FeedRow[] = FEED_SOURCES.map((s) => {
    const configured = s.configured();
    const m = meta[s.id];
    return { ...(m ?? {}), id: s.id, label: s.label, provider: s.provider, tier: s.tier, baseIntervalMin: s.baseIntervalMin, configured, health: feedHealth(m, configured) };
  });

  const coupons: OffersSummary["coupons"] = {};
  if (sources) {
    const count = (list: Array<Parameters<typeof isShopOfferActive>[0]>) => ({ total: list.length, active: list.filter((c) => isShopOfferActive(c)).length });
    coupons.dognet = count(sources.dognet);
    coupons.ehub = count(sources.ehub);
    coupons.cj = count(sources.cj);
    coupons.affial = count(sources.affial);
    coupons.manual = count(sources.manual);
  }

  const offers: OffersSummary = {
    articles: summarizeArticles(articles, (a) => resolveShopSlugSync(reg, { slug: a.shopSlug, name: a.shopName, domain: a.domain })),
    coupons,
  };

  const links = Object.values(linkMap);
  const linkSummary = {
    total: links.length,
    ok: links.filter((l) => l.status === "ok" || l.status === "redirect").length,
    warn: links.filter((l) => l.status === "warn").length,
    dead: links.filter((l) => l.status === "dead").length,
    deadSample: links.filter((l) => l.status !== "ok" && l.status !== "redirect").slice(0, 20),
  };

  const facebook = await getFacebookOverview().catch((e) => ({ error: String(e?.message ?? e) }));

  let seo: OpsOverview["seo"] = { error: "nenačítané" };
  if (opts.withSeo !== false) {
    try {
      const [inventory, index] = await Promise.all([getSeoInventory(), getShopSeoIndex()]);
      const categoriesWithoutOffers = TAXONOMY_LIST.filter((cat) => buildCategoryShops(cat, reg, index).reduce((n, s) => n + s.offers, 0) === 0).map((c) => c.id);
      seo = {
        ...inventory,
        shopsWithoutOffers: index.filter((s) => s.activeCodes + s.activeDeals + s.activeArticles === 0).length,
        categoriesWithoutOffers,
      };
    } catch (e) {
      seo = { error: e instanceof Error ? e.message : String(e) };
    }
  }

  return { generatedAt: new Date().toISOString(), feeds, offers, facebook, seo, links: linkSummary, alerts, resolvedAlerts, lastJobs, recentJobs };
}
