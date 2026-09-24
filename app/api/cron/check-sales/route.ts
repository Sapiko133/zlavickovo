import { NextRequest } from "next/server";
import { isCronAuthorized } from "@/lib/auth";
import { runTick } from "@/lib/automation/tick";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Manuálny spúšťač lifecycle akčných článkov + Facebook (bez feedov).
 * Plánovaná automatika beží cez /api/cron/tick. ?dryRun=1 nič nezapíše.
 */
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const result = await runTick({
    trigger: "manual:check-sales",
    dryRun: req.nextUrl.searchParams.get("dryRun") === "1",
    steps: ["articles", "seo", "facebook", "alerts"],
  });
  return Response.json(result, { status: result.ok ? 200 : 500 });
}
