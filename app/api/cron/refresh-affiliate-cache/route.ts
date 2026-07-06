import { refreshDognetCache, refreshDognetCampaignsCache } from "@/lib/dognet";
import { refreshEhubCache, refreshEhubShopsCache } from "@/lib/ehub";
import { invalidateKnownShopsCache } from "@/lib/all-shops";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [dognet, dognetCampaigns, ehubCoupons, ehubShops] = await Promise.allSettled([
    refreshDognetCache(),
    refreshDognetCampaignsCache(),
    refreshEhubCache(),
    refreshEhubShopsCache(),
  ]);

  // Zdrojové cache sa zmenili — shops:known nech sa prebuduje z čerstvých dát
  await invalidateKnownShopsCache();

  return Response.json({
    ok: true,
    dognet: dognet.status === "fulfilled" ? dognet.value : { count: 0, error: String(dognet.reason) },
    dognetCampaigns: dognetCampaigns.status === "fulfilled" ? dognetCampaigns.value : { count: 0, error: String(dognetCampaigns.reason) },
    ehubCoupons: ehubCoupons.status === "fulfilled" ? ehubCoupons.value : { count: 0, error: String(ehubCoupons.reason) },
    ehubShops: ehubShops.status === "fulfilled" ? ehubShops.value : { count: 0, error: String(ehubShops.reason) },
  });
}
