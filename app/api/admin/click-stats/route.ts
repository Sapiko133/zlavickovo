import { getClickStats, getRecentClicks } from "@/lib/click-log";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Read-only reporting outbound/affiliate klikov (Redis). Bez verejného UI.
 * Vráti pre okná 24h / 7d / 30d: top 50 obchodov, top 50 produktov,
 * top 50 kupónov, kliky podľa typu a source, Heureka fallback + all-time total.
 * Chránené Bearer CRON_SECRET (rovnako ako /api/admin/search-stats).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [stats, recent] = await Promise.all([getClickStats(), getRecentClicks(20)]);
    return Response.json({ ok: true, ...stats, recent });
  } catch (err: any) {
    return Response.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}
