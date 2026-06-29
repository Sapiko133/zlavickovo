import { getEhubShops } from "@/lib/ehub";
import { normalizeShopSlug } from "@/lib/slug";

export const revalidate = 86400;

function toDomain(web: string): string {
  try {
    const url = web.startsWith("http") ? web : `https://${web}`;
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return web.replace(/^www\./, "");
  }
}


export async function GET() {
  try {
    const shops = await getEhubShops();
    const result = shops
      .filter(s => s.name && s.web)
      .map(s => ({
        name: s.name,
        slug: normalizeShopSlug(s.name),
        category: s.category || "Iné",
        domain: toDomain(s.web),
      }));
    return Response.json(result, {
      headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=3600" },
    });
  } catch {
    return Response.json([]);
  }
}
