import { MetadataRoute } from "next";
import { TAXONOMY_LIST } from "@/lib/taxonomy";
import { getAllKnownShops, getStaticKnownShops } from "@/lib/all-shops";
import { isAdultShop } from "@/lib/shop-categories";
import { getPublishedArticles } from "@/lib/articles";
import { LETAKY } from "@/lib/letaky";
import { getTopProductIds, toProductSlug } from "@/lib/heureka/query";

export const revalidate = 3600;

const BASE = "https://www.zlavickovo.sk";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Jediný zdroj pravdy — lib/all-shops.ts (rovnaké slugy ako autocomplete a /obchody)
  let shops: Awaited<ReturnType<typeof getAllKnownShops>> = [];
  try { shops = await getAllKnownShops(); } catch { shops = getStaticKnownShops(); }

  // Erotické / 18+ obchody nechávame mimo sitemap (stránky ostávajú dostupné)
  const indexableShops = shops.filter(shop => !isAdultShop(shop));

  const shopUrls: MetadataRoute.Sitemap = indexableShops.flatMap(shop => {
    const urls: MetadataRoute.Sitemap = [
      { url: `${BASE}/kupony/${shop.slug}`, lastModified: new Date(), changeFrequency: "daily" as const, priority: 0.8 },
    ];
    // CZ mutácia stránky existuje len pre Dognet kampane
    if (shop.source === "dognet") {
      urls.push({ url: `${BASE}/kupony/${shop.slug}-cz`, lastModified: new Date(), changeFrequency: "daily" as const, priority: 0.7 });
    }
    return urls;
  });

  const categoryUrls: MetadataRoute.Sitemap = TAXONOMY_LIST.map(c => ({
    url: `${BASE}/kategoria/${c.id}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const letakyUrls: MetadataRoute.Sitemap = LETAKY.map(l => ({
    url: `${BASE}/letaky/${l.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  // Produkty z hk_products (Heureka DB)
  let productUrls: MetadataRoute.Sitemap = [];
  try {
    const products = await getTopProductIds(10000);
    productUrls = products.map(p => ({
      url: `${BASE}/produkt/${toProductSlug(p.name, p.id)}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));
  } catch {}

  let articleUrls: MetadataRoute.Sitemap = [];
  try {
    const articles = await getPublishedArticles();
    articleUrls = articles.map(a => ({
      url: `${BASE}/akcie/${a.slug}`,
      lastModified: new Date(a.updatedAt || a.date),
      changeFrequency: a.type === "sale" ? "daily" as const : "monthly" as const,
      priority: a.type === "sale" ? 0.7 : 0.5,
    }));
  } catch {}

  return [
    { url: BASE,                    lastModified: new Date(), changeFrequency: "daily",  priority: 1.0 },
    { url: `${BASE}/obchody`,       lastModified: new Date(), changeFrequency: "daily",  priority: 0.9 },
    { url: `${BASE}/kupony`,        lastModified: new Date(), changeFrequency: "daily",  priority: 0.9 },
    { url: `${BASE}/akcie`,         lastModified: new Date(), changeFrequency: "daily",  priority: 0.9 },
    { url: `${BASE}/letaky`,        lastModified: new Date(), changeFrequency: "daily",  priority: 0.8 },
    { url: `${BASE}/kategoria`,     lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE}/produkty`,      lastModified: new Date(), changeFrequency: "daily",  priority: 0.8 },

    ...categoryUrls,
    ...letakyUrls,
    ...articleUrls,
    ...shopUrls,
    ...productUrls,
  ];
}
