/**
 * Automatizačný tick — jediný vstupný bod plánovanej automatiky.
 *
 * Spúšťače (všetky zadarmo): Vercel Cron (Hobby = každý záznam 1×/deň → 4 časové
 * sloty) + voliteľne GitHub Actions (.github/workflows/automation-tick.yml).
 * Viac spúšťačov = jemnejšia granularita, nikdy nie viac práce: tick spustí len
 * SPLATNÉ feedy (adaptívny interval z lib/feeds/engine.ts) a Redis zámok bráni
 * súbežným behom.
 *
 * Poradie: feedy → (zmena obchodov) invalidácia zoznamu obchodov → lifecycle akcií
 * → SEO index warm + sitemap kontrola → Facebook plán/publikovanie → link health
 * → alerty. Každý krok má vlastný job log; výpadok jedného kroku nezastaví ďalšie.
 */
import { redisKv } from "@/lib/kv";
import { startJob, getLastJobRuns, safeErrorMessage } from "@/lib/jobs/log";
import { FEED_SOURCES } from "@/lib/feeds/sources";
import { isFeedDue, loadAllFeedMeta, runFeed, type FeedEffect, type FeedRunReport } from "@/lib/feeds/engine";
import { generateSaleArticles, type GenerateResult } from "@/lib/sale-articles";
import { invalidateKnownShopsCache } from "@/lib/all-shops";
import { getShopSeoIndex } from "@/lib/seo/shop-index";
import { sitemapEntries } from "@/lib/seo/sitemap";
import { runFacebookAutomation, type FacebookRunResult } from "@/lib/social/facebook";
import { loadQueue } from "@/lib/social/fb-queue";
import { runLinkHealthBatch, type LinkCheckRun } from "@/lib/links/health";
import { getAllArticles } from "@/lib/articles";
import { evaluateAlerts, syncAlerts, type AlertSyncResult } from "@/lib/ops/alerts";

export type TickStep = "feeds" | "articles" | "seo" | "facebook" | "links" | "alerts";
const ALL_STEPS: TickStep[] = ["feeds", "articles", "seo", "facebook", "links", "alerts"];

export interface TickOptions {
  trigger: string;
  dryRun?: boolean;
  /** Vynúti feedy bez ohľadu na plán ("all" alebo zoznam ID). */
  forceFeeds?: "all" | string[];
  steps?: TickStep[];
  /** Rozpočet behu (ms) — Vercel maxDuration je 300 s. */
  budgetMs?: number;
}

export interface TickResult {
  ok: boolean;
  skipped?: "locked";
  trigger: string;
  dryRun: boolean;
  durationMs: number;
  feeds: FeedRunReport[];
  changedEffects: FeedEffect[];
  articles?: Omit<GenerateResult, "created" | "deactivated" | "staled" | "restored"> & { created: number; deactivated: number; staled: number; restored: number };
  seo?: { warmed: boolean; indexable?: number; sitemapShops?: number | null; error?: string };
  facebook?: Pick<FacebookRunResult, "enabled" | "dryRun"> & { planStatus: string; planned: number; publish: string; error?: string };
  links?: LinkCheckRun | { error: string };
  alerts?: AlertSyncResult;
  errors: string[];
}

const LOCK_KEY = "lock:automation-tick";

export async function runTick(opts: TickOptions): Promise<TickResult> {
  const t0 = Date.now();
  const deadline = t0 + (opts.budgetMs ?? 250_000);
  const dryRun = Boolean(opts.dryRun);
  const steps = new Set(opts.steps ?? ALL_STEPS);
  const tickJob = startJob("tick", { trigger: opts.trigger, dryRun });
  const result: TickResult = { ok: true, trigger: opts.trigger, dryRun, durationMs: 0, feeds: [], changedEffects: [], errors: [] };

  if (!dryRun) {
    const acquired = await redisKv.set(LOCK_KEY, new Date(t0).toISOString(), { nx: true, ex: 290 }).catch(() => true);
    if (!acquired) {
      await tickJob.finish("skipped", {}, "iný tick práve beží");
      return { ...result, skipped: "locked", durationMs: Date.now() - t0 };
    }
  }

  const timeLeft = () => deadline - Date.now();
  let articlesResult: GenerateResult | null = null;
  let fbError: string | null = null;
  let fbStatus = "";
  let sitemapInfo: { shops: number | null; error?: string | null } | null = null;

  try {
    // ── 1. FEEDY (len splatné; providery paralelne, v rámci providera sekvenčne) ──
    if (steps.has("feeds")) {
      const meta = await loadAllFeedMeta();
      const now = Date.now();
      const due = FEED_SOURCES.filter((s) =>
        opts.forceFeeds === "all" || (Array.isArray(opts.forceFeeds) ? opts.forceFeeds.includes(s.id) : isFeedDue(meta[s.id], now)));
      const byProvider = new Map<string, typeof due>();
      for (const s of due) byProvider.set(s.provider, [...(byProvider.get(s.provider) ?? []), s]);
      const chains = [...byProvider.values()].map(async (list) => {
        const reports: FeedRunReport[] = [];
        for (const def of list) {
          if (timeLeft() < 60_000) break; // nechaj čas na ďalšie kroky, feed počká na ďalší tick
          const job = startJob(`feed:${def.id}`, { trigger: opts.trigger, dryRun });
          const r = await runFeed(def, { dryRun, deadline: deadline - 60_000, meta: meta[def.id] });
          await job.finish(
            r.status === "error" ? "error" : r.status === "rejected" ? "warning" : r.status === "skipped" ? "skipped" : "ok",
            { items: r.items, new: r.new, updated: r.updated, removed: r.removed, invalid: r.invalid, duplicates: r.duplicates, attempts: r.attempts, changed: r.changed ? 1 : 0 },
            r.error ?? null,
          );
          reports.push(r);
        }
        return reports;
      });
      result.feeds = (await Promise.all(chains)).flat();
      const effects = new Set<FeedEffect>();
      for (const r of result.feeds) if (r.changed) for (const e of FEED_SOURCES.find((s) => s.id === r.id)?.affects ?? []) effects.add(e);
      result.changedEffects = [...effects];
      if (effects.has("shops") && !dryRun) await invalidateKnownShopsCache();
    }

    // ── 2. LIFECYCLE AKCIÍ (každý tick — grace/expirácia závisí aj od času) ──
    if (steps.has("articles") && timeLeft() > 45_000) {
      const job = startJob("articles", { trigger: opts.trigger, dryRun });
      try {
        articlesResult = await generateSaleArticles({ dryRun });
        const a = articlesResult;
        result.articles = { ...a, created: a.created.length, deactivated: a.deactivated.length, staled: a.staled.length, restored: a.restored.length };
        await job.finish(a.guardTriggered ? "warning" : "ok", {
          actions: a.scannedActions, created: a.created.length, deactivated: a.deactivated.length,
          stale: a.staled.length, restored: a.restored.length, unchanged: a.unchanged, writes: a.writes, keptUnhealthy: a.keptUnhealthy,
        });
      } catch (e) {
        result.errors.push(`articles: ${safeErrorMessage(e)}`);
        await job.finish("error", {}, e);
      }
    }

    // ── 3. SEO: prepočítaj index obchodov po zmene dát (nie pri requeste návštevníka) ──
    if (steps.has("seo") && timeLeft() > 40_000) {
      const dataChanged = result.feeds.some((r) => r.changed) || (articlesResult?.writes ?? 0) > 0;
      const job = startJob("seo", { trigger: opts.trigger, dryRun });
      try {
        let indexable: number | undefined;
        if (dataChanged && !dryRun) {
          const index = await getShopSeoIndex({ fresh: true });
          indexable = index.filter((s) => s.index).length;
        }
        const shops = await sitemapEntries("shops").then((e) => e.length);
        sitemapInfo = { shops };
        result.seo = { warmed: dataChanged && !dryRun, indexable, sitemapShops: shops };
        await job.finish(shops < 100 ? "error" : "ok", { warmed: dataChanged && !dryRun ? 1 : 0, indexable: indexable ?? -1, sitemapShops: shops });
      } catch (e) {
        const msg = safeErrorMessage(e);
        sitemapInfo = { shops: null, error: msg };
        result.seo = { warmed: false, error: msg };
        result.errors.push(`seo: ${msg}`);
        await job.finish("error", {}, e);
      }
    }

    // ── 4. FACEBOOK ──
    if (steps.has("facebook") && timeLeft() > 30_000) {
      try {
        const fb = await runFacebookAutomation({ dryRun, trigger: opts.trigger });
        fbStatus = fb.publish.status;
        fbError = fb.publish.error ?? null;
        result.facebook = { enabled: fb.enabled, dryRun: fb.dryRun, planStatus: fb.plan.status, planned: fb.plan.items.length, publish: fb.publish.status, error: fb.publish.error };
      } catch (e) {
        fbStatus = "failed";
        fbError = safeErrorMessage(e);
        result.facebook = { enabled: true, dryRun, planStatus: "error", planned: 0, publish: "failed", error: fbError };
        result.errors.push(`facebook: ${fbError}`);
      }
    }

    // ── 5. LINK HEALTH (malá dávka, len pri dostatku času) ──
    if (steps.has("links") && timeLeft() > 60_000) {
      const job = startJob("link-health", { trigger: opts.trigger, dryRun });
      try {
        const articles = await getAllArticles();
        const urls = articles.filter((a) => a.type === "sale" && a.published && a.affiliateUrl).map((a) => a.affiliateUrl!);
        const run = await runLinkHealthBatch(urls, { budget: 20, deadline: deadline - 30_000, dryRun });
        result.links = run;
        await job.finish(run.dead > 0 ? "warning" : "ok", { ...run });
      } catch (e) {
        result.links = { error: safeErrorMessage(e) };
        await job.finish("error", {}, e);
      }
    }

    // ── 6. ALERTY ──
    if (steps.has("alerts")) {
      const job = startJob("alerts", { trigger: opts.trigger, dryRun });
      try {
        const [meta, queue, lastRuns] = await Promise.all([loadAllFeedMeta(), loadQueue(redisKv), getLastJobRuns()]);
        const now = Date.now();
        const failedLast3Days = queue.filter((i) => i.status === "failed" && now - Date.parse(i.updatedAt) < 3 * 86400_000).length;
        const conditions = evaluateAlerts({
          now,
          feeds: FEED_SOURCES.map((s) => ({ ...meta[s.id], maxIntervalMin: s.maxIntervalMin })).filter((m) => m.id),
          articles: articlesResult ? { guardTriggered: articlesResult.guardTriggered, deactivated: articlesResult.deactivated.length } : null,
          facebook: fbStatus ? { status: fbStatus, error: fbError, failedLast3Days } : null,
          sitemap: sitemapInfo,
          jobErrors: ["articles", "link-health"].map((j) => lastRuns[j]).filter((r) => r?.status === "error").map((r) => ({ job: r.job, error: r.error })),
        });
        result.alerts = await syncAlerts(conditions, { dryRun });
        await job.finish(conditions.some((c) => c.level === "critical") ? "warning" : "ok", { active: result.alerts.active, opened: result.alerts.opened.length, resolved: result.alerts.resolved.length, notified: result.alerts.notified ? 1 : 0 });
      } catch (e) {
        result.errors.push(`alerts: ${safeErrorMessage(e)}`);
        await job.finish("error", {}, e);
      }
    }
  } finally {
    if (!dryRun) await redisKv.del(LOCK_KEY).catch(() => {});
  }

  result.durationMs = Date.now() - t0;
  const feedErrors = result.feeds.filter((f) => f.status === "error").length;
  result.ok = result.errors.length === 0;
  await tickJob.finish(result.errors.length ? "error" : feedErrors ? "warning" : "ok", {
    feedsRun: result.feeds.length,
    feedsChanged: result.feeds.filter((f) => f.changed).length,
    feedErrors,
    articleWrites: articlesResult?.writes ?? 0,
  }, result.errors.join("; ") || null);
  return result;
}
