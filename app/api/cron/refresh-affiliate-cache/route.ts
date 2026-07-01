import { refreshDognetCache } from "@/lib/dognet";
import { refreshEhubCache, refreshEhubShopsCache } from "@/lib/ehub";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  const trigger = req.nextUrl.searchParams.get("trigger");

  const isCronAuth = cronSecret && authHeader === `Bearer ${cronSecret}`;
  const isAdminTrigger = trigger === "admin";

  if (!isCronAuth && !isAdminTrigger) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [dognet, ehubCoupons, ehubShops] = await Promise.allSettled([
    refreshDognetCache(),
    refreshEhubCache(),
    refreshEhubShopsCache(),
  ]);

  return Response.json({
    ok: true,
    dognet: dognet.status === "fulfilled" ? dognet.value : { count: 0, error: String(dognet.reason) },
    ehubCoupons: ehubCoupons.status === "fulfilled" ? ehubCoupons.value : { count: 0, error: String(ehubCoupons.reason) },
    ehubShops: ehubShops.status === "fulfilled" ? ehubShops.value : { count: 0, error: String(ehubShops.reason) },
  });
}
