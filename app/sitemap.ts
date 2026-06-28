import { MetadataRoute } from "next";
import { getShops } from "@/lib/dognet";
import { CATEGORIES } from "@/lib/categories";

export const revalidate = 3600;

const BASE = "https://zlavickovo.sk";

function slug(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-");
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let shops: { id: number; name: string; count: number }[] = [];
  try { shops = await getShops(); } catch {}

  const shopUrls = shops.flatMap(shop => [
    { url: `${BASE}/kupony/${slug(shop.name)}`, lastModified: new Date(), changeFrequency: "hourly" as const, priority: 0.8 },
    { url: `${BASE}/kupony/${slug(shop.name)}-cz`, lastModified: new Date(), changeFrequency: "hourly" as const, priority: 0.7 },
  ]);

  const categoryUrls: MetadataRoute.Sitemap = Object.keys(CATEGORIES).map(catSlug => ({
    url: `${BASE}/kategoria/${catSlug}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [
    { url: BASE,                    lastModified: new Date(), changeFrequency: "daily",  priority: 1.0 },
    { url: `${BASE}/obchody`,       lastModified: new Date(), changeFrequency: "daily",  priority: 0.9 },
    { url: `${BASE}/kupony`,        lastModified: new Date(), changeFrequency: "daily",  priority: 0.9 },
    { url: `${BASE}/letaky`,        lastModified: new Date(), changeFrequency: "daily",  priority: 0.8 },
    { url: `${BASE}/kategoria`,     lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE}/cashback`,      lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/blog`,          lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    ...categoryUrls,
    ...shopUrls,
  ];
}
