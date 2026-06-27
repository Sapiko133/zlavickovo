import { getEhubShops } from "@/lib/ehub";

export const revalidate = 86400;

function toDomain(web: string): string {
  try {
    const url = web.startsWith("http") ? web : `https://${web}`;
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return web.replace(/^www\./, "");
  }
}

function toSlug(name: string): string {
  return name.toLowerCase()
    .replace(/[áä]/g, "a").replace(/[čć]/g, "c").replace(/[ďđ]/g, "d")
    .replace(/[éě]/g, "e").replace(/[íî]/g, "i").replace(/[ľĺ]/g, "l")
    .replace(/[ňń]/g, "n").replace(/[óô]/g, "o").replace(/[řŕ]/g, "r")
    .replace(/[šś]/g, "s").replace(/[ťţ]/g, "t").replace(/[úůü]/g, "u")
    .replace(/[ýÿ]/g, "y").replace(/[žź]/g, "z")
    .replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export async function GET() {
  try {
    const shops = await getEhubShops();
    const result = shops
      .filter(s => s.name && s.web)
      .map(s => ({
        name: s.name,
        slug: toSlug(s.name),
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
