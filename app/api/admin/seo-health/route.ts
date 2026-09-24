import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getLastSeoReport, getSeoInventory, runAndStoreSeoAudit } from "@/lib/seo/health";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SESSION_COOKIE = "admin_session";

/** Admin session (dashboard) alebo Bearer CRON_SECRET (automatika/CI). */
async function isAuthed(req: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") === `Bearer ${secret}`) return true;
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  return !!adminPassword && (await cookies()).get(SESSION_COOKIE)?.value === adminPassword;
}

/**
 * GET  → { inventory, report } (posledný uložený crawl report + živý inventár z dát)
 * GET ?run=1 alebo POST → spustí crawl audit produkcie (~2–4 min) a uloží ho.
 * Odpoveď 503, ak audit našiel chyby severity "error" (pre monitoring/CI).
 */
export async function GET(req: NextRequest) {
  if (!(await isAuthed(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const run = req.nextUrl.searchParams.get("run") === "1";
  try {
    const [inventory, report] = await Promise.all([
      getSeoInventory(),
      run ? runAndStoreSeoAudit() : getLastSeoReport(),
    ]);
    const status = run && report && report.summary.errors > 0 ? 503 : 200;
    return NextResponse.json({ ok: status === 200, inventory, report }, { status });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}

/** POST z admin dashboardu — spustí audit a vráti sa na /admin/seo. */
export async function POST(req: NextRequest) {
  if (!(await isAuthed(req))) return NextResponse.redirect(new URL("/admin", req.url), 303);
  try {
    await runAndStoreSeoAudit();
    return NextResponse.redirect(new URL("/admin/seo?done=1", req.url), 303);
  } catch (err: any) {
    const url = new URL("/admin/seo", req.url);
    url.searchParams.set("error", (err?.message ?? "chyba").slice(0, 140));
    return NextResponse.redirect(url, 303);
  }
}
