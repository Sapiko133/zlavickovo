/**
 * SEO health — dve vrstvy:
 *  1. inventory (rýchle, z dát): koľko URL je indexovateľných/noindex podľa
 *     politiky, ukončené ponuky, duplicitné ponuky, obchody bez ponuky.
 *  2. crawl report (pomalé, z hotového HTML): lib/seo/audit.ts nad produkciou —
 *     title/H1/meta/canonical/robots/sitemap/odkazy/structured data.
 * Posledný crawl report sa ukladá do Redis (admin dashboard ho len číta).
 */
import { getAllArticles, type Article } from "@/lib/articles";
import { redis } from "@/lib/redis";
import { SITE_URL } from "./config";
import { SEO_AUDIT_EXTRA_PATHS } from "./audit-paths";
import { runSeoAudit, type AuditReport } from "./audit";
import { articleLifecycle, duplicateArticleCanonicals } from "./indexing";
import { getShopSeoIndex } from "./shop-index";
import { sitemapEntries, SITEMAP_TYPES } from "./sitemap";

const REPORT_KEY = "seo:health:report:v1";

export interface SeoInventory {
  generatedAt: string;
  sitemap: Record<string, number>;
  shops: { total: number; indexable: number; noindex: number; noindexSample: string[] };
  offers: {
    total: number;
    active: number;
    expiredHistorical: number;
    gone: number;
    /** Publikované, ale validTo v minulosti — cron ich ešte nedeaktivoval. */
    publishedButExpired: string[];
    duplicates: { slug: string; canonical: string }[];
  };
}

export async function getSeoInventory(): Promise<SeoInventory> {
  const [shopIndex, articles] = await Promise.all([
    getShopSeoIndex(),
    getAllArticles().catch(() => [] as Article[]),
  ]);
  const sitemap: Record<string, number> = {};
  for (const t of SITEMAP_TYPES) {
    sitemap[t] = await sitemapEntries(t).then((e) => e.length).catch(() => -1);
  }
  const sale = articles.filter((a) => a.type === "sale");
  const states = sale.map((a) => ({ a, st: articleLifecycle(a).state }));
  const dup = duplicateArticleCanonicals(articles.filter((a) => a.published));
  const noindexShops = shopIndex.filter((s) => !s.index);
  return {
    generatedAt: new Date().toISOString(),
    sitemap,
    shops: {
      total: shopIndex.length,
      indexable: shopIndex.length - noindexShops.length,
      noindex: noindexShops.length,
      noindexSample: noindexShops.slice(0, 50).map((s) => `/kupony/${s.slug}`),
    },
    offers: {
      total: sale.length,
      active: states.filter((x) => x.st === "active").length,
      expiredHistorical: states.filter((x) => x.st === "expired").length,
      gone: states.filter((x) => x.st === "gone").length,
      publishedButExpired: states.filter((x) => x.a.published && x.st !== "active").map((x) => `/akcie/${x.a.slug}`),
      duplicates: [...dup.entries()].map(([slug, canonical]) => ({ slug: `/akcie/${slug}`, canonical: `/akcie/${canonical}` })),
    },
  };
}

export async function runAndStoreSeoAudit(base = SITE_URL): Promise<AuditReport> {
  const report = await runSeoAudit({ base, extraPaths: SEO_AUDIT_EXTRA_PATHS, concurrency: 8, maxLinkChecks: 300 });
  // Do Redis len to, čo dashboard zobrazuje (limit veľkosti hodnoty).
  const stored: AuditReport = {
    ...report,
    issues: report.issues.slice(0, 1500),
    pages: report.pages.map((p) => ({ ...p, jsonLdTypes: [], jsonLdErrors: p.jsonLdErrors.slice(0, 3) })),
  };
  try { await redis.set(REPORT_KEY, stored, { ex: 60 * 60 * 24 * 14 }); } catch {}
  return report;
}

export async function getLastSeoReport(): Promise<AuditReport | null> {
  try {
    return (await redis.get<AuditReport>(REPORT_KEY)) ?? null;
  } catch {
    return null;
  }
}
