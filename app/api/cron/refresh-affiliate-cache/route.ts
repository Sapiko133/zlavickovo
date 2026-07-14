import { refreshDognetCache, refreshDognetCampaignsCache } from "@/lib/dognet";
import { refreshEhubCache, refreshEhubShopsCache } from "@/lib/ehub";
import { refreshCjShopsCache } from "@/lib/cj";
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

  // Dognet coupons + campaigns bežia SEKVENČNE v jednom bloku (paralelne by dvojnásobná
  // záťaž na Dognet API rate-limitovala pagination kampaní → neúplný cache).
  // eHub (iné API) ide paralelne popri Dognet bloku.
  const [dognetPair, ehubCoupons, ehubShops, cjShops] = await Promise.allSettled([
    (async () => {
      const coupons = await refreshDognetCache();
      const campaigns = await refreshDognetCampaignsCache();
      return { coupons, campaigns };
    })(),
    refreshEhubCache(),
    refreshEhubShopsCache(),
    refreshCjShopsCache(),
  ]);
  const dognet = dognetPair.status === "fulfilled" ? dognetPair.value.coupons : { count: 0, error: String((dognetPair as PromiseRejectedResult).reason) };
  const dognetCampaigns = dognetPair.status === "fulfilled" ? dognetPair.value.campaigns : { count: 0, error: String((dognetPair as PromiseRejectedResult).reason) };

  // Zdrojové cache sa zmenili — shops:known nech sa prebuduje z čerstvých dát
  await invalidateKnownShopsCache();

  return Response.json({
    ok: true,
    dognet,
    dognetCampaigns,
    ehubCoupons: ehubCoupons.status === "fulfilled" ? ehubCoupons.value : { count: 0, error: String(ehubCoupons.reason) },
    ehubShops: ehubShops.status === "fulfilled" ? ehubShops.value : { count: 0, error: String(ehubShops.reason) },
    cjShops: cjShops.status === "fulfilled" ? cjShops.value : { count: 0, error: String(cjShops.reason) },
  });
}
