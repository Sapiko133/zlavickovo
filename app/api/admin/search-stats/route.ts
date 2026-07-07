import { getSearchStats } from "@/lib/search-log";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

// Read-only reporting vyhľadávacích dopytov (Redis).
// Vráti top 100 dopytov za 24h / 7d / 30d + timestamp posledného vyhľadania.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const stats = await getSearchStats(100);
    return Response.json({ ok: true, ...stats });
  } catch (err: any) {
    return Response.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}
