import { searchHkProducts, toProductSlug, formatPrice } from "@/lib/heureka/query";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  if (!q.trim()) return Response.json([]);

  try {
    const products = await searchHkProducts(q, 20);
    const mapped = products.map((p) => ({
      name: p.name,
      description: p.description ?? "",
      url: `/produkt/${toProductSlug(p.name, p.id)}`,
      affiliateUrl: p.affiliate_url || p.url,
      domain: p.domain,
      price: formatPrice(p.price, p.domain),
      imgUrl: p.img_url,
      source: "heureka",
    }));
    return Response.json(mapped);
  } catch {
    return Response.json([]);
  }
}
