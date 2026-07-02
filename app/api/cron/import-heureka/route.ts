import { importAllHeurekaFeeds } from "@/lib/heureka/import";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 54 feedov v batchoch po 10, fetch timeout 60s + upserty po 50

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await importAllHeurekaFeeds();
    const total = results.reduce((s, r) => s + r.count, 0);
    const errors = results.filter((r) => r.error);
    return Response.json({
      ok: true,
      total,
      feeds: results.length,
      errors: errors.length,
      results,
    });
  } catch (err: any) {
    return Response.json({ ok: false, error: err?.message ?? "Unknown" }, { status: 500 });
  }
}
