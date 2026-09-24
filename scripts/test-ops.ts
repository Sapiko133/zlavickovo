/**
 * Link health (bez klikov na tracking linky, "dead" až po opakovaných zlyhaniach),
 * alerting (podmienky, otvorenie/vyriešenie, throttling notifikácií) a job log.
 * Spustenie: npx tsx scripts/test-ops.ts  (bez siete, in-memory KV)
 */
import assert from "node:assert/strict";
import { createMemoryKv } from "../lib/kv.ts";
import { checkUrl, isAffiliateLinkDead, isDueForCheck, LINK_HEALTH_KEY, mergeHealth, runLinkHealthBatch, type LinkHealth } from "../lib/links/health.ts";
import { evaluateAlerts, syncAlerts, ALERTS_KEY } from "../lib/ops/alerts.ts";
import { getRecentJobRuns, safeErrorMessage, startJob } from "../lib/jobs/log.ts";
import type { FeedMeta } from "../lib/feeds/engine.ts";

function res(status: number, location?: string): Response {
  return new Response(null, { status, headers: location ? { location } : {} });
}

async function main() {
  const now = Date.parse("2026-09-24T10:00:00Z");

  // ── checkUrl: redirect reťaz, 405 → GET fallback, 404 ──
  {
    const hops: string[] = [];
    const fetcher = async (url: string, init: RequestInit) => {
      hops.push(`${init.method} ${url}`);
      if (url === "https://a.sk/") return res(301, "https://www.a.sk/");
      if (url === "https://www.a.sk/") return res(init.method === "HEAD" ? 405 : 200);
      if (url === "https://gone.sk/") return res(404);
      return res(200);
    };
    const r = await checkUrl("https://a.sk/", fetcher);
    assert.equal(r.status, "redirect");
    assert.equal(r.redirects, 1);
    assert.equal(r.finalUrl, "https://www.a.sk/");
    assert.ok(hops.includes("GET https://www.a.sk/"), "HEAD 405 → GET fallback");
    assert.equal((await checkUrl("https://gone.sk/", fetcher)).status, "dead");
    const loop = async (url: string) => res(302, url + "x");
    assert.equal((await checkUrl("https://loop.sk/", loop)).status, "warn", "nekonečná reťaz sa zastaví");
  }

  // ── mergeHealth: dočasná chyba ponuku nevyradí; dead až po 3 zlyhaniach ──
  {
    const dead = { url: "u", status: "dead" as const, httpStatus: 404, redirects: 0, finalUrl: "u", error: "HTTP 404" };
    let h: LinkHealth = mergeHealth(null, dead, now);
    assert.equal(h.status, "warn");
    h = mergeHealth(h, dead, now);
    assert.equal(h.status, "warn");
    h = mergeHealth(h, dead, now);
    assert.equal(h.status, "dead", "3× po sebe 404 = dead");
    h = mergeHealth(h, { ...dead, status: "ok", httpStatus: 200, error: null }, now);
    assert.equal(h.status, "ok");
    assert.equal(h.consecutiveFailures, 0);
    assert.equal(isDueForCheck(h, now + 86400_000), false, "OK link sa recheckuje až o 7 dní");
    assert.equal(isDueForCheck({ ...h, status: "warn" }, now + 13 * 3600_000), true);
  }

  // ── runLinkHealthBatch: tracking link bez cieľa sa NEVOLÁ, rozpočet dávky ──
  {
    const kv = createMemoryKv();
    const called: string[] = [];
    const fetcher = async (url: string) => { called.push(url); return res(url.includes("gone") ? 404 : 200); };
    const urls = [
      "https://www.anrdoezrs.net/click-101812521-17310669-1782313361000", // CJ bez cieľa
      "https://go.dognet.com/?chid=x&url=https%3A%2F%2Fshop1.sk%2F",
      "https://go.dognet.com/?chid=y&url=https%3A%2F%2Fshop1.sk%2F%3Futm_source%3Da", // rovnaký cieľ
      "https://ehub.cz/system/scripts/click.php?a_aid=1&desturl=https%3A%2F%2Fgone.sk%2F",
      "https://shop3.sk/akcia",
    ];
    const r = await runLinkHealthBatch(urls, { kv, now: () => now, budget: 2, fetcher });
    assert.equal(r.skippedNoDestination, 1);
    assert.equal(r.checked, 2);
    assert.equal(r.pending, 1);
    assert.ok(called.every((u) => !/dognet|ehub|anrdoezrs/.test(u)), "tracking redirecty sa nikdy nevolajú");
    await runLinkHealthBatch(urls, { kv, now: () => now, budget: 5, fetcher });
    const map = (await kv.hgetall<LinkHealth>(LINK_HEALTH_KEY))!;
    assert.equal(Object.keys(map).length, 3, "3 unikátne cieľové URL");
    assert.equal(isAffiliateLinkDead(urls[3], map), false, "1× 404 ešte nie je dead");
  }

  // ── Alerty: podmienky ──
  {
    const feed = (p: Partial<FeedMeta>): FeedMeta & { maxIntervalMin: number } => ({
      id: "f", label: "Feed F", status: "ok", consecutiveErrors: 0, lastSuccessAt: new Date(now - 3600_000).toISOString(),
      intervalMin: 180, pendingDrop: null, lastErrorKind: null, lastError: null, lastSuccessItemCount: 100, maxIntervalMin: 720, ...p,
    } as FeedMeta & { maxIntervalMin: number });
    const c = evaluateAlerts({
      now,
      feeds: [
        feed({ id: "a", consecutiveErrors: 3, status: "error", lastErrorKind: "timeout", lastError: "timeout" }),
        feed({ id: "b", lastSuccessAt: new Date(now - 50 * 3600_000).toISOString() }),
        feed({ id: "c", pendingDrop: { count: 10, seen: 1, firstAt: "" } }),
        feed({ id: "d", lastErrorKind: "empty", status: "error", consecutiveErrors: 1 }),
        feed({ id: "e" }),
      ],
      articles: { guardTriggered: true, deactivated: 0 },
      facebook: { status: "failed", error: "Error validating access token (190)", failedLast3Days: 2 },
      sitemap: { shops: 40 },
    });
    const keys = c.map((x) => x.key);
    assert.ok(keys.includes("feed:a:errors"), "feed zlyhal 3×");
    assert.ok(keys.includes("feed:b:stale"), "feed bez úspechu > 36 h");
    assert.ok(keys.includes("feed:c:drop"), "náhly pokles");
    assert.ok(keys.includes("feed:d:empty"), "0 položiek");
    assert.ok(!keys.some((k) => k.startsWith("feed:e")), "zdravý feed bez alertu");
    assert.ok(keys.includes("offers:mass-expire"));
    assert.ok(keys.includes("facebook:token"));
    assert.ok(keys.includes("facebook:failing"));
    assert.ok(keys.includes("sitemap:degraded"));
  }

  // ── Alerty: otvorenie, throttling notifikácií, vyriešenie ──
  {
    const kv = createMemoryKv();
    const sent: string[] = [];
    const notify = async (subject: string) => { sent.push(subject); return true; };
    const cond = [{ key: "feed:x:errors", level: "critical" as const, message: "x zlyháva" }];
    let r = await syncAlerts(cond, { kv, now, notify });
    assert.deepEqual(r.opened, ["feed:x:errors"]);
    assert.equal(sent.length, 1);
    r = await syncAlerts(cond, { kv, now: now + 3600_000, notify });
    assert.equal(sent.length, 1, "rovnaký alert sa nenotifikuje každý tick");
    await syncAlerts(cond, { kv, now: now + 25 * 3600_000, notify });
    assert.equal(sent.length, 2, "pripomienka po 24 h");
    r = await syncAlerts([], { kv, now: now + 26 * 3600_000, notify });
    assert.deepEqual(r.resolved, ["feed:x:errors"]);
    assert.equal(await kv.hgetall(ALERTS_KEY), null);
  }

  // ── Job log: záznam behu, bez citlivých údajov ──
  {
    const kv = createMemoryKv();
    let t = now;
    const job = startJob("feed:test", { trigger: "vercel-cron:a", kv, now: () => t });
    t += 1500;
    await job.finish("error", { items: 3 }, new Error("GET https://api.x/?apiKey=SECRET123 failed token=abc Bearer xyz.123"));
    const [run] = await getRecentJobRuns(10, kv);
    assert.equal(run.durationMs, 1500);
    assert.equal(run.status, "error");
    assert.equal(run.counts.items, 3);
    assert.ok(!/SECRET123|abc|xyz\.123/.test(run.error ?? ""), `logy bez tajomstiev: ${run.error}`);
    assert.equal(safeErrorMessage("password=hunter2"), "password=[redacted]");
    const dry = startJob("x", { kv, dryRun: true });
    await dry.finish("ok");
    assert.equal((await getRecentJobRuns(10, kv)).length, 1, "dry-run sa nezapisuje");
  }

  console.log("Ops tests passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
