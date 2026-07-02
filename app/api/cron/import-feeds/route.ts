import { feedManager } from "@/lib/feeds/FeedManager";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await feedManager.importAll();
    return Response.json({
      ok: true,
      ...result,
      message: `Import dokončený. Celkom ${result.total} produktov.`,
    });
  } catch (err: any) {
    return Response.json({ ok: false, error: err?.message ?? "Unknown error" }, { status: 500 });
  }
}
