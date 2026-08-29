import { getDognetCampaignCoverage } from "@/lib/dognet";
import { getEhubCampaignCoverage } from "@/lib/ehub";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Read-only audit pokrytia affiliate sietí — používa PROD credentials (Dognet
 * login, eHub API key), ktoré nie sú lokálne dostupné. Vracia zoznam kampaní,
 * o ktoré treba POŽIADAŤ (Dognet `available` = ad_channel nie je v kampani;
 * eHub `notApproved` = publisher nie je schválený), plus prehľad joinnutých.
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>` (rovnako ako db-maintenance).
 *   GET /api/admin/affiliate-coverage            → plný JSON (aj zoznamy)
 *   GET /api/admin/affiliate-coverage?counts=1   → len počty (rýchly prehľad)
 *
 * CJ: link-search API vracia len joined advertiserov — „available" zoznam sa
 * cez súčasnú integráciu nedá enumerovať, preto tu nie je.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const countsOnly = req.nextUrl.searchParams.get("counts") === "1";

  const [dognetRes, ehubRes] = await Promise.allSettled([
    getDognetCampaignCoverage(),
    getEhubCampaignCoverage(),
  ]);

  const dognet = dognetRes.status === "fulfilled"
    ? dognetRes.value
    : { error: dognetRes.reason instanceof Error ? dognetRes.reason.message : String(dognetRes.reason) };
  const ehub = ehubRes.status === "fulfilled"
    ? ehubRes.value
    : { error: ehubRes.reason instanceof Error ? ehubRes.reason.message : String(ehubRes.reason) };

  const summary = {
    dognet: "error" in dognet ? dognet : {
      totalCampaigns: dognet.totalCampaigns,
      joined: dognet.joined.length,
      pending: dognet.pending.length,
      available: dognet.available.length,
    },
    ehub: "error" in ehub ? ehub : {
      total: ehub.total,
      approved: ehub.approved.length,
      notApproved: ehub.notApproved.length,
    },
  };

  if (countsOnly) {
    return Response.json({ ok: true, generatedAt: new Date().toISOString(), summary });
  }

  return Response.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    summary,
    // „Požiadať" zoznamy:
    dognetToRequest: "error" in dognet ? [] : dognet.available,
    dognetPending: "error" in dognet ? [] : dognet.pending,
    ehubToRequest: "error" in ehub ? [] : ehub.notApproved,
    _errors: {
      dognet: "error" in dognet ? dognet.error : null,
      ehub: "error" in ehub ? ehub.error : null,
    },
  });
}
