import { NextRequest } from "next/server";
import { isCronAuthorized } from "@/lib/auth";
import { runTick, type TickStep } from "@/lib/automation/tick";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const STEPS: TickStep[] = ["feeds", "articles", "seo", "facebook", "links", "alerts"];

/**
 * Automatizačný tick (Vercel Cron sloty + voliteľne GitHub Actions).
 *   ?dryRun=1            nič nezapíše ani nepublikuje (feedy sa stiahnu a porovnajú)
 *   ?force=all|id1,id2   spustí feedy bez ohľadu na plán
 *   ?steps=feeds,articles  len vybrané kroky
 *   ?source=github       označenie spúšťača v job logu
 */
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const force = sp.get("force");
  const steps = sp.get("steps")?.split(",").filter((s): s is TickStep => STEPS.includes(s as TickStep));
  const slot = req.nextUrl.pathname.split("/").pop();
  const trigger = sp.get("source") || (req.headers.get("user-agent")?.includes("vercel-cron") ? `vercel-cron:${slot}` : "manual");
  try {
    const result = await runTick({
      trigger,
      dryRun: sp.get("dryRun") === "1",
      forceFeeds: force === "all" ? "all" : force ? force.split(",") : undefined,
      steps: steps?.length ? steps : undefined,
    });
    return Response.json(result, { status: result.ok ? 200 : 500 });
  } catch (err) {
    console.error("[tick] zlyhal:", err instanceof Error ? err.message : err);
    return Response.json({ ok: false, error: "Tick zlyhal — pozri /admin/ops" }, { status: 500 });
  }
}
