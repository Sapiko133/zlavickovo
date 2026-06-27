import { searchProducts } from "@/lib/feeds/AffialFeedProvider";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  if (!q.trim()) return Response.json([]);

  try {
    const products = await searchProducts(q);
    return Response.json(products);
  } catch {
    return Response.json([]);
  }
}
