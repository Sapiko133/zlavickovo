import { NextRequest, NextResponse } from "next/server";
import { isAdminOrCron } from "@/lib/auth";
import { getOpsOverview } from "@/lib/ops/overview";
import { runTick } from "@/lib/automation/tick";
import { runFacebookAutomation } from "@/lib/social/facebook";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Operations API (admin cookie alebo Bearer CRON_SECRET).
 *   GET                         prehľad (feedy, ponuky, Facebook, SEO, odkazy, alerty, joby)
 *   GET ?action=tick-dry        dry-run celého ticku (feedy stiahne a porovná, nič nezapíše)
 *   GET ?action=fb-dry          dry-run Facebook plánu (texty postov bez publikovania)
 *   POST action=tick            manuálny tick (z dashboardu)
 */
export async function GET(req: NextRequest) {
  if (!(await isAdminOrCron(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const action = req.nextUrl.searchParams.get("action");
  try {
    if (action === "tick-dry") {
      return NextResponse.json(await runTick({ trigger: "admin:dry-run", dryRun: true, forceFeeds: "all" }));
    }
    if (action === "fb-dry") {
      return NextResponse.json(await runFacebookAutomation({ dryRun: true, trigger: "admin:dry-run" }));
    }
    const overview = await getOpsOverview({ withSeo: req.nextUrl.searchParams.get("seo") !== "0" });
    const critical = overview.alerts.some((a) => a.level === "critical");
    return NextResponse.json({ ok: !critical, ...overview }, { status: critical ? 503 : 200 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdminOrCron(req))) return NextResponse.redirect(new URL("/admin", req.url), 303);
  const form = await req.formData().catch(() => null);
  const action = String(form?.get("action") ?? "");
  const url = new URL("/admin/ops", req.url);
  try {
    if (action === "tick") {
      const r = await runTick({ trigger: "admin:manual" });
      url.searchParams.set("ran", r.skipped ? "locked" : `feeds ${r.feeds.length}, zmien ${r.feeds.filter((f) => f.changed).length}, chyby ${r.errors.length}`);
    } else if (action === "tick-force") {
      const r = await runTick({ trigger: "admin:force", forceFeeds: "all" });
      url.searchParams.set("ran", r.skipped ? "locked" : `vynútené feedy ${r.feeds.length}, zmien ${r.feeds.filter((f) => f.changed).length}, chyby ${r.errors.length}`);
    }
  } catch (err) {
    url.searchParams.set("error", (err instanceof Error ? err.message : String(err)).slice(0, 140));
  }
  return NextResponse.redirect(url, 303);
}
