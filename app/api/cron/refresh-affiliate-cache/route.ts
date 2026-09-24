import { NextRequest } from "next/server";
import { isCronAuthorized } from "@/lib/auth";
import { runTick } from "@/lib/automation/tick";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Manuálny vynútený refresh všetkých feedov cez feed engine (ochrana proti
 * prázdnym/podozrivým dátam platí rovnako). Plánovaný beh: /api/cron/tick.
 * ?dryRun=1 feedy stiahne a porovná, ale nič nezapíše.
 */
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const result = await runTick({
    trigger: "manual:refresh-affiliate-cache",
    dryRun: req.nextUrl.searchParams.get("dryRun") === "1",
    forceFeeds: "all",
    steps: ["feeds", "articles", "seo", "alerts"],
  });
  return Response.json(result, { status: result.ok ? 200 : 500 });
}
