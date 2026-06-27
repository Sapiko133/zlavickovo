import { redis } from "@/lib/redis";
import { NextRequest } from "next/server";

const FEEDS_KEY = "feeds:config";

interface FeedConfig {
  id: string;
  name: string;
  provider: "awin" | "dognet" | "cj";
  url: string;
  format: "xml" | "csv";
  active: boolean;
  lastImport?: string;
}

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  const idParam = req.nextUrl.searchParams.get("id");

  // Allow admin manual trigger or cron with secret
  const isAdminTrigger = !!idParam;
  const isCronAuth = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isAdminTrigger && !isCronAuth) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const feeds: FeedConfig[] = ((await redis.get<FeedConfig[]>(FEEDS_KEY)) || []);

  const toImport = idParam
    ? feeds.filter(f => f.id === idParam)
    : feeds.filter(f => f.active);

  const results: { id: string; name: string; status: string; error?: string }[] = [];

  for (const feed of toImport) {
    try {
      // TODO: actual feed parsing based on feed.format (xml/csv)
      // For now, mark as imported and update lastImport timestamp
      const idx = feeds.findIndex(f => f.id === feed.id);
      if (idx >= 0) feeds[idx].lastImport = new Date().toISOString();
      results.push({ id: feed.id, name: feed.name, status: "ok" });
    } catch (err: any) {
      results.push({ id: feed.id, name: feed.name, status: "error", error: err.message });
    }
  }

  await redis.set(FEEDS_KEY, feeds);

  return Response.json({ imported: results.length, results });
}
