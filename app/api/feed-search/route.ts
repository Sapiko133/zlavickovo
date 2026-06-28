import { searchProducts } from "@/lib/feeds/AffialFeedProvider";
import { braveSearch } from "@/lib/braveSearch";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  if (!q.trim()) return Response.json([]);

  try {
    const products = await searchProducts(q);
    if (products.length > 0) return Response.json(products);

    // Brave Search fallback when feeds return nothing
    const braveResults = await braveSearch(`${q} kúpiť slovensko`);
    if (braveResults.length > 0) {
      const mapped = braveResults.map(r => ({
        name: r.title,
        description: r.description,
        url: r.url,
        affiliateUrl: r.url,
        domain: (() => { try { return new URL(r.url).hostname.replace(/^www\./, ""); } catch { return ""; } })(),
        price: null,
        source: "brave",
      }));
      return Response.json(mapped);
    }

    return Response.json([]);
  } catch {
    return Response.json([]);
  }
}
