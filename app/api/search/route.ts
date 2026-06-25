import { getAiCoupons } from "@/lib/ai-search";

export async function POST(req: Request) {
  const { shopName, country = "sk" } = await req.json();
  if (!shopName) return Response.json({ error: "Chýba shopName" }, { status: 400 });

  try {
    const result = await getAiCoupons(shopName, country);
    return Response.json(result);
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
