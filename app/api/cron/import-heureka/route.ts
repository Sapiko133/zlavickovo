import { importAllHeurekaFeeds } from "@/lib/heureka/import";
import { HEUREKA_MAX_ITEMS } from "@/lib/heureka/config";
import { getDb } from "@/lib/db";
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
    const durationMs = Date.now() - startedAt;

    const total = results.reduce((s, r) => s + r.count, 0);
    const errors = results.filter((r) => r.error);

    // Top pomalé feedy (ak už existujú dáta o trvaní)
    const topSlow = [...results]
      .filter((r) => r.durationMs > 0)
      .sort((a, b) => b.durationMs - a.durationMs)
      .slice(0, 5)
      .map((r) => ({ feedId: r.feedId, domain: r.domain, count: r.count, durationMs: r.durationMs }));

    let dbTotal: number | null = null;
    try {
      const rows = await getDb()`SELECT COUNT(*)::int AS total FROM hk_products`;
      dbTotal = (rows[0] as { total: number }).total;
    } catch {}

    return Response.json({
      ok: true,
      // ── bezpečný report ──
      usedLimit: HEUREKA_MAX_ITEMS, // aktuálny limit produktov/feed (env HEUREKA_MAX_ITEMS)
      feeds: results.length,        // počet feedov
      total,                        // importovaných produktov (súčet cez feedy)
      dbTotal,                      // celkový počet v DB
      errors: errors.length,        // počet chýb
      durationMs,                   // trvanie importu (ms)
      topSlow,                      // najpomalšie feedy
      prune,
      results,
    });
  } catch (err: any) {
    return Response.json({ ok: false, error: err?.message ?? "Unknown" }, { status: 500 });
  }
}
