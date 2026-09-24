/**
 * Facebook automatický content engine — napojenie na reálne dáta Zlavickovo.
 *
 * Kandidáti = aktívne, indexovateľné, neduplikované affiliate akcie (rovnaká
 * SEO logika ako web: lib/seo/indexing.ts), s monetizovaným odkazom, bez 18+
 * obchodov, bez mŕtveho cieľa (lib/links/health.ts). Ukončená ponuka sa
 * nikdy nevyberie; nová ponuka automaticky vstupuje do poolu.
 */
import { getAllArticles, getArticleBySlug, type Article } from "@/lib/articles";
import { redis } from "@/lib/redis";
import { redisKv } from "@/lib/kv";
import { startJob } from "@/lib/jobs/log";
import { isAdultShop, resolveCategory } from "@/lib/shop-categories";
import { SITE_URL } from "@/lib/seo/config";
import { duplicateArticleCanonicals, isArticleIndexable } from "@/lib/seo/indexing";
import { getShopRegistry, resolveShopSlugSync } from "@/lib/seo/shop-registry";
import { getLinkHealthMap, isAffiliateLinkDead } from "@/lib/links/health";
import { isTrackedAffiliateUrl } from "@/lib/offers/url";
import { facebookConfig, findPublishedPost, publishPhotoPost } from "./fb-graph";
import { titleKey, type FbCandidate, type FbHistoryEntry } from "./fb-select";
import {
  FB_LEGACY_POSTED_KEY,
  fbSettingsFromEnv,
  loadQueue,
  planDay,
  publishDue,
  queueStats,
  type FbDeps,
  type PlanResult,
  type PublishResult,
} from "./fb-queue";

function isPostableArticle(a: Article, dup: Map<string, string>): boolean {
  return (
    a.type === "sale" &&
    a.origin === "affiliate-action" &&
    a.published &&
    !a.missingSince &&
    isArticleIndexable(a) &&
    !dup.has(a.slug) &&
    isTrackedAffiliateUrl(a.affiliateUrl) &&
    !isAdultShop({ slug: a.shopSlug, name: a.shopName, domain: a.domain })
  );
}

async function shopClicks(slugs: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const unique = [...new Set(slugs)].filter(Boolean);
  for (let i = 0; i < unique.length; i += 200) {
    const chunk = unique.slice(i, i + 200);
    const vals = (await redis.mget<(number | null)[]>(...chunk.map((s) => `click:outbound:shop:${s}`)).catch(() => [])) ?? [];
    chunk.forEach((s, j) => out.set(s, Number(vals[j]) || 0));
  }
  return out;
}

export async function loadFbCandidates(): Promise<FbCandidate[]> {
  const [articles, reg, health] = await Promise.all([getAllArticles(), getShopRegistry(), getLinkHealthMap()]);
  const dup = duplicateArticleCanonicals(articles.filter((a) => a.published));
  const postable = articles.filter((a) => isPostableArticle(a, dup) && !isAffiliateLinkDead(a.affiliateUrl!, health));
  const rows = postable.map((a) => {
    const shopSlug = resolveShopSlugSync(reg, { slug: a.shopSlug, name: a.shopName, domain: a.domain }) || a.shopSlug || "";
    return { a, shopSlug };
  });
  const clicks = await shopClicks(rows.map((r) => r.shopSlug));
  return rows.map(({ a, shopSlug }) => ({
    key: a.actionKey || a.slug,
    slug: a.slug,
    shopSlug,
    shopName: a.shopName || shopSlug,
    title: a.title,
    discountPct: a.discountPct ?? null,
    validTo: a.validTo ?? null,
    firstSeenAt: a.date,
    imageSource: a.imageSource ?? null,
    affiliateUrl: a.affiliateUrl!,
    categoryId: resolveCategory({ slug: shopSlug, name: a.shopName, domain: a.domain }),
    shopClicks: clicks.get(shopSlug) ?? 0,
  }));
}

/** História pred queue v2 (hash facebook:posted-actions) — pre cooldowny. */
async function loadLegacyHistory(): Promise<FbHistoryEntry[]> {
  const posted = (await redisKv.hgetall<unknown>(FB_LEGACY_POSTED_KEY).catch(() => null)) ?? {};
  const slugs = Object.keys(posted);
  if (slugs.length === 0) return [];
  const bySlug = new Map((await getAllArticles()).map((a) => [a.slug, a]));
  const out: FbHistoryEntry[] = [];
  for (const slug of slugs) {
    const raw = posted[slug];
    let publishedAt = "";
    try {
      const v = typeof raw === "string" ? JSON.parse(raw) : raw;
      publishedAt = (v as { publishedAt?: string })?.publishedAt ?? "";
    } catch {}
    if (!publishedAt) continue;
    const a = bySlug.get(slug);
    const shopSlug = a?.shopSlug ?? null;
    out.push({
      key: a?.actionKey || slug,
      slug,
      shopSlug,
      categoryId: a ? resolveCategory({ slug: a.shopSlug, name: a.shopName, domain: a.domain }) : null,
      titleKey: a && shopSlug ? titleKey(shopSlug, a.title) : null,
      hookId: null,
      templateId: null,
      textHash: null,
      publishedAt,
    });
  }
  return out;
}

export function realFbDeps(): FbDeps {
  const cfg = facebookConfig();
  return {
    kv: redisKv,
    now: Date.now,
    loadCandidates: loadFbCandidates,
    loadLegacyHistory,
    async checkEligible(item) {
      const a = await getArticleBySlug(item.slug);
      if (!a) return "článok neexistuje";
      if (!a.published || !isArticleIndexable(a)) return "akcia skončila";
      if (a.missingSince) return "akcia chýba vo feede (stale)";
      const all = await getAllArticles();
      if (duplicateArticleCanonicals(all.filter((x) => x.published)).has(a.slug)) return "duplicitná akcia";
      if (isAffiliateLinkDead(a.affiliateUrl ?? "", await getLinkHealthMap())) return "mŕtvy cieľový odkaz";
      return null;
    },
    publish: (item) => publishPhotoPost(cfg, { imageUrl: item.imageUrl, caption: item.text }),
    verify: (item) => findPublishedPost(cfg, {
      textPrefix: item.text.slice(0, 80),
      since: (Date.parse(item.publishingAt || item.updatedAt) || Date.now()) - 15 * 60_000,
    }),
    imageUrlFor: (slug) => `${SITE_URL}/akcie/${encodeURIComponent(slug)}/opengraph-image`,
    // Do postu ide monetizovaný affiliate odkaz (overená prax FB auto-postingu).
    linkFor: (c) => c.affiliateUrl,
  };
}

export interface FacebookRunResult {
  enabled: boolean;
  dryRun: boolean;
  plan: Omit<PlanResult, "items"> & { items: Array<{ id: string; shopName: string; scheduledAt: string; score: number; templateId: string; text: string }> };
  publish: PublishResult;
}

/** Plán dňa + publikovanie splatného postu. dryRun = nič sa nezapíše ani nepublikuje. */
export async function runFacebookAutomation(opts: { dryRun?: boolean; trigger?: string } = {}): Promise<FacebookRunResult> {
  const cfg = facebookConfig();
  const dryRun = Boolean(opts.dryRun) || cfg.dryRun;
  const settings = fbSettingsFromEnv();
  const deps = realFbDeps();
  const job = startJob("facebook", { trigger: opts.trigger, dryRun });
  try {
    const plan = await planDay(deps, settings, { dryRun });
    const publish = await publishDue(deps, settings, { dryRun, enabled: cfg.enabled });
    const status = publish.status === "failed" || publish.status === "unknown" ? "error" : publish.status === "retry" ? "warning" : "ok";
    await job.finish(status, {
      planned: plan.items.length,
      candidates: plan.candidates,
      eligible: plan.eligible,
      published: publish.status === "published" ? 1 : 0,
      recovered: publish.recovered,
      skippedStale: publish.skippedStale,
    }, publish.error ?? null);
    return {
      enabled: cfg.enabled,
      dryRun,
      plan: { ...plan, items: plan.items.map((i) => ({ id: i.id, shopName: i.shopName, scheduledAt: i.scheduledAt, score: i.score, templateId: i.templateId, text: i.text })) },
      publish,
    };
  } catch (e) {
    await job.finish("error", {}, e);
    throw e;
  }
}

export async function getFacebookOverview() {
  const [items, candidates] = await Promise.all([loadQueue(redisKv), loadFbCandidates().catch(() => [])]);
  const sorted = [...items].sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
  return {
    config: { enabled: facebookConfig().enabled, dryRun: facebookConfig().dryRun, ...fbSettingsFromEnv() },
    candidates: candidates.length,
    stats: queueStats(items),
    upcoming: sorted.filter((i) => i.status === "scheduled" || i.status === "publishing").reverse().slice(0, 10),
    recent: sorted.filter((i) => i.status !== "scheduled").slice(0, 15),
  };
}
