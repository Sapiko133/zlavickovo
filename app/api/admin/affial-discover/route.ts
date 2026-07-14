import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { discoverFromPatterns, discoverFromLogin, getCustomFeeds } from "@/lib/feeds/AffialDiscovery";

export const dynamic = "force-dynamic";

const SESSION_COOKIE = "admin_session";

/**
 * Autorizácia: admin_session cookie (ADMIN_PASSWORD) ALEBO Bearer CRON_SECRET
 * (konzistentné s ostatnými admin/cron endpointmi — umožňuje spustiť discovery
 * serverovo bez admin session).
 */
async function authorized(req: Request): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authHeader = req.headers.get("authorization");
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;

  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  return Boolean(adminPassword) && session === adminPassword;
}

export async function GET(req: Request) {
  if (!(await authorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode") ?? "patterns";

  const result = mode === "login" ? await discoverFromLogin() : await discoverFromPatterns();
  // Vráť aj nájdené feed URL (nielen počty), aby ich volajúci vedel spracovať.
  const feeds = await getCustomFeeds().catch(() => []);
  return NextResponse.json({ ...result, feeds });
}
