import { getAffiliateActions } from "@/lib/affiliate-actions";
import {
  actionContentHash,
  buildAffiliateActionPerex,
  buildSaleSeoContent,
} from "@/lib/article-seo";
import {
  getAllArticles,
  saveArticle,
  type Article,
} from "@/lib/articles";
import { resolveActionImage } from "@/lib/action-image";
import { isOfferActive } from "@/lib/offers/freshness";
import { loadAllFeedMeta, type FeedMeta } from "@/lib/feeds/engine";

/**
 * Synchronizácia akčných článkov (/akcie/[slug]) s aktuálnymi affiliate akciami.
 * Volá ju feed tick (lib/feeds/tick.ts) po zmene zdrojov akcií, príp. manuálne
 * /api/cron/check-sales.
 *
 * OFFER LIFECYCLE (článok ponuky):
 *   active     akcia je v poslednom validnom feede
 *   stale      akcia z validného feedu zmizla, ale je v grace perióde (článok ostáva
 *              publikovaný a indexovaný — chráni pred flappingom pri výkyvoch feedu)
 *   expired    validTo prešiel ALEBO grace uplynula → published=false; SEO vrstva
 *              (lib/seo/indexing.ts articleLifecycle) → noindex historická stránka
 *   removed    30 dní po skončení → 308 na obchod (existujúce SEO pravidlo)
 *   duplicate  rieši lib/seo/indexing.ts duplicateArticleCanonicals (canonical)
 *
 * FAILURE SAFETY: akcie providera, ktorého feed je v chybe (alebo o ňom nič nevieme),
 * sa NIKDY nedeaktivujú kvôli "zmiznutiu". Ak by beh deaktivoval nezvyčajne veľa
 * článkov naraz, deaktivácia sa zastaví (guard) a vznikne alert.
 */

/** Ako dlho môže akcia chýbať vo validnom feede, kým ju považujeme za ukončenú. */
export const ACTION_MISSING_GRACE_HOURS = 24;
/** Feed je "zdravý" pre lifecycle, ak mal úspech v tomto okne. */
const PROVIDER_HEALTHY_WINDOW_HOURS = 36;
/** Guard: viac "missing" deaktivácií naraz = pravdepodobne problém dát, nie realita. */
const MASS_DEACTIVATION_MIN = 10;
const MASS_DEACTIVATION_RATIO = 0.25;

// Max. koľko reálnych obrázkov doťaháme za jeden beh (chráni runtime).
// Cez SALE_IMAGE_BUDGET sa dá zvýšiť pre jednorazový backfill.
const IMAGE_BUDGET = Number(process.env.SALE_IMAGE_BUDGET) || 40;

/** Feed zdroj, z ktorého pochádzajú akcie danej siete (actionKey "dognet:123"). */
const PROVIDER_ACTION_FEEDS: Record<string, string[]> = {
  dognet: ["dognet-coupons"],
  ehub: ["ehub-vouchers"],
  cj: ["cj-coupons"],
  affial: ["affial-coupons"],
};

export function providerOfArticle(a: Pick<Article, "actionKey">): string | null {
  return a.actionKey ? a.actionKey.split(":")[0] || null : null;
}

/** Zdravie providerov z metadát feed enginu. Statické akcie sú vždy "zdravé". */
export function providerHealthFromMeta(meta: Record<string, FeedMeta>, now = Date.now()): Record<string, boolean> {
  const out: Record<string, boolean> = { static: true };
  for (const [provider, feeds] of Object.entries(PROVIDER_ACTION_FEEDS)) {
    out[provider] = feeds.every((id) => {
      const m = meta[id];
      const last = m?.lastSuccessAt ? Date.parse(m.lastSuccessAt) : NaN;
      return m?.status === "ok" && Number.isFinite(last) && now - last <= PROVIDER_HEALTHY_WINDOW_HOURS * 3600_000;
    });
  }
  return out;
}

export type MissingDecision =
  | { action: "keep"; reason: string }
  | { action: "mark_stale"; missingSince: string }
  | { action: "deactivate"; reason: "expired" | "missing" };

/** Čo urobiť s publikovaným článkom, ktorého akcia v aktuálnych dátach chýba. Čistá funkcia. */
export function decideMissingAction(
  a: Pick<Article, "validTo" | "missingSince">,
  providerHealthy: boolean,
  now = Date.now(),
  graceHours = ACTION_MISSING_GRACE_HOURS,
): MissingDecision {
  if (a.validTo && !isOfferActive(a.validTo, now)) return { action: "deactivate", reason: "expired" };
  if (!providerHealthy) return { action: "keep", reason: "provider-unhealthy" };
  if (!a.missingSince) return { action: "mark_stale", missingSince: new Date(now).toISOString() };
  const since = Date.parse(a.missingSince);
  if (!Number.isFinite(since)) return { action: "mark_stale", missingSince: new Date(now).toISOString() };
  return now - since >= graceHours * 3600_000
    ? { action: "deactivate", reason: "missing" }
    : { action: "keep", reason: "grace" };
}

export interface GenerateResult {
  scannedDomains: number;
  scannedActions: number;
  created: string[];
  deactivated: string[];
  staled: string[];
  restored: string[];
  keptUnhealthy: number;
  guardTriggered: boolean;
  unchanged: number;
  writes: number;
  dryRun: boolean;
  timestamp: string;
}

export async function generateSaleArticles(opts: { dryRun?: boolean; now?: number } = {}): Promise<GenerateResult> {
  const dryRun = Boolean(opts.dryRun);
  const nowMs = opts.now ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();
  let writes = 0;
  const save = async (a: Article) => {
    writes++;
    if (!dryRun) await saveArticle(a);
  };

  const [existing, affiliateActions, feedMeta] = await Promise.all([
    getAllArticles(),
    getAffiliateActions().catch(() => []),
    loadAllFeedMeta(),
  ]);
  const existingBySlug = new Map(existing.map((a) => [a.slug, a]));
  const providerHealthy = providerHealthFromMeta(feedMeta, nowMs);

  const created: string[] = [];
  const restored: string[] = [];
  let unchanged = 0;
  const generatedActionSlugs = new Set<string>();

  // Každá aktuálna affiliate akcia dostane vlastný stabilný detail a SEO obsah.
  let imageBudget = IMAGE_BUDGET;
  for (const action of affiliateActions) {
    const prev = existingBySlug.get(action.articleSlug);
    const contentHash = actionContentHash(action);
    generatedActionSlugs.add(action.articleSlug);

    // Reálny obrázok akcie (banner inzerenta → feed → og:image). Ťaháme len keď
    // ho ešte nemáme a v rámci rozpočtu behu; výsledok je v Redise cachovaný.
    let imageUrl = prev?.imageUrl;
    let imageSource = prev?.imageSource;
    if (!imageUrl && imageBudget > 0 && !dryRun) {
      imageBudget--;
      const resolved = await resolveActionImage({
        shopName: action.shopName,
        domain: action.domain,
      }).catch(() => null);
      if (resolved) {
        imageUrl = resolved.url;
        imageSource = resolved.source;
      }
    }

    // Nehýb updatedAt ani sitemap lastmod, pokiaľ sa nezmenili vstupné dáta akcie
    // ani sa nedoplnil nový obrázok. Akcia sa vrátila do feedu → len zruš "stale".
    if (prev?.contentHash === contentHash && prev.published && imageUrl === prev?.imageUrl) {
      if (prev.missingSince) {
        await save({ ...prev, missingSince: null });
        restored.push(prev.slug);
      } else {
        unchanged++;
      }
      continue;
    }

    const article: Article = {
      slug: action.articleSlug,
      type: "sale",
      title: action.title.toLocaleLowerCase("sk").includes(action.shopName.toLocaleLowerCase("sk"))
        ? action.title
        : `${action.shopName}: ${action.title}`,
      perex: buildAffiliateActionPerex(action),
      shopName: action.shopName,
      domain: action.domain,
      shopSlug: action.shopSlug,
      discountPct: action.discountPct,
      products: prev?.products || [],
      imageUrl,
      imageSource,
      affiliateUrl: action.affiliateUrl,
      date: prev?.date ?? nowIso,
      updatedAt: nowIso,
      published: true,
      source: "auto",
      validTo: action.validTo,
      actionKey: action.actionKey,
      origin: "affiliate-action",
      contentHash,
      missingSince: null,
    };
    article.content = buildSaleSeoContent(article);
    await save(article);
    created.push(article.slug);
  }

  // ── EXPIRE: každý automat spravuje iba vlastné články (nie scrapované ani ručné) ──
  const candidates = existing.filter((a) =>
    a.type === "sale" && a.source === "auto" && a.published &&
    ((a.origin === "affiliate-action" && !generatedActionSlugs.has(a.slug)) ||
      // Legacy produktové výpredaje (Heureka odstránená) už nikdy nevzniknú.
      a.origin === "price-drop"));

  const decisions = candidates.map((a) => {
    if (a.origin === "price-drop") return { a, d: { action: "deactivate", reason: "expired" } as MissingDecision };
    const provider = providerOfArticle(a) ?? "";
    return { a, d: decideMissingAction(a, providerHealthy[provider] ?? false, nowMs) };
  });

  const activeAuto = existing.filter((a) => a.type === "sale" && a.origin === "affiliate-action" && a.published).length;
  const missingDeactivations = decisions.filter((x) => x.d.action === "deactivate" && x.d.reason === "missing").length;
  const guardTriggered = missingDeactivations > Math.max(MASS_DEACTIVATION_MIN, activeAuto * MASS_DEACTIVATION_RATIO);
  if (guardTriggered) {
    console.error(`[sale-articles] GUARD: ${missingDeactivations}/${activeAuto} akcií by sa deaktivovalo naraz — deaktivácia pozastavená`);
  }

  const deactivated: string[] = [];
  const staled: string[] = [];
  let keptUnhealthy = 0;
  for (const { a, d } of decisions) {
    if (d.action === "deactivate") {
      if (d.reason === "missing" && guardTriggered) continue;
      const endedAt = d.reason === "expired" && a.validTo ? a.validTo : nowIso;
      await save({ ...a, published: false, updatedAt: nowIso, validTo: endedAt, missingSince: null });
      deactivated.push(a.slug);
    } else if (d.action === "mark_stale") {
      await save({ ...a, missingSince: d.missingSince });
      staled.push(a.slug);
    } else if (d.reason === "provider-unhealthy") {
      keptUnhealthy++;
    }
  }

  return {
    scannedDomains: 0,
    scannedActions: affiliateActions.length,
    created,
    deactivated,
    staled,
    restored,
    keptUnhealthy,
    guardTriggered,
    unchanged,
    writes,
    dryRun,
    timestamp: nowIso,
  };
}
