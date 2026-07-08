import { importAllHeurekaFeeds } from "@/lib/heureka/import";
import { HEUREKA_MAX_ITEMS } from "@/lib/heureka/config";
import { getDb } from "@/lib/db";
import { redis } from "@/lib/redis";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 52 feedov v batchoch po 10, fetch timeout 60s + bulk upsert

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const startedAt = Date.now();
    const { results, prune } = await importAllHeurekaFeeds();
    const totalDurationMs = Date.now() - startedAt;

    const importedProducts = results.reduce((s, r) => s + r.count, 0);

    // Kategorizácia feedov (vzájomne výlučné): success | empty | timeout | failed
    const successful = results.filter((r) => r.count > 0);
    const empty = results.filter((r) => r.empty);
    const timeout = results.filter((r) => r.errorType === "timeout");
    const failed = results.filter((r) => r.errorType && r.errorType !== "timeout");

    // Per-feed trvanie (zoradené od najpomalších)
    const perFeedDurationMs = [...results]
      .sort((a, b) => b.durationMs - a.durationMs)
      .map((r) => ({
        feedId: r.feedId,
        domain: r.domain,
        count: r.count,
        durationMs: r.durationMs,
        errorType: r.errorType,
        empty: r.empty,
      }));

    const topSlow = perFeedDurationMs.filter((r) => r.durationMs > 0).slice(0, 10);

    const slim = (r: (typeof results)[number]) => ({
      feedId: r.feedId,
      domain: r.domain,
      durationMs: r.durationMs,
      error: r.error,
      errorType: r.errorType,
    });

    let dbTotal: number | null = null;
    try {
      const rows = await getDb()`SELECT COUNT(*)::int AS total FROM hk_products`;
      dbTotal = (rows[0] as { total: number }).total;
    } catch {}

    // ── Perzistentný report do Redis: heureka:import:full:{YYYY-MM-DD} ──
    const dateKey = new Date().toISOString().slice(0, 10);
    const report = {
      ok: true,
      startedAt: new Date(startedAt).toISOString(),
      usedLimit: HEUREKA_MAX_ITEMS,
      feeds: results.length,
      totalDurationMs,
      importedProducts,
      dbTotal,
      counts: {
        successful: successful.length,
        empty: empty.length,
        timeout: timeout.length,
        failed: failed.length,
      },
      successfulFeeds: successful.map((r) => r.feedId),
      emptyFeeds: empty.map(slim),
      timeoutFeeds: timeout.map(slim),
      failedFeeds: failed.map(slim),
      perFeedDurationMs,
      topSlow,
      prune,
    };
    try {
      await redis.set(`heureka:import:full:${dateKey}`, report, { ex: 60 * 60 * 24 * 30 });
    } catch {}

    return Response.json({ ...report, results });
  } catch (err: any) {
    return Response.json({ ok: false, error: err?.message ?? "Unknown" }, { status: 500 });
  }
}
