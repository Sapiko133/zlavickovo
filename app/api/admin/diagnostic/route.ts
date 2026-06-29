import { getCoupons } from "@/lib/dognet";
import { getEhubCoupons, getEhubShops } from "@/lib/ehub";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const source = searchParams.get("source");

  if (source === "ehub") {
    const [shops, coupons] = await Promise.all([
      getEhubShops().catch(() => []),
      getEhubCoupons().catch(() => []),
    ]);
    return Response.json({ shops: shops.length, coupons_count: coupons.length });
  }

  // Default: Dognet
  const coupons = await getCoupons().catch(() => []);
  return Response.json({ coupons: coupons.slice(0, 5) });
}
