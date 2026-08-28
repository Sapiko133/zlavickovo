import { MetadataRoute } from "next";
import { TAXONOMY_LIST } from "@/lib/taxonomy";
import { getAllKnownShops, getStaticKnownShops } from "@/lib/all-shops";
import { isAdultShop } from "@/lib/shop-categories";
import { getPublishedArticles } from "@/lib/articles";
import { LETAKY } from "@/lib/letaky";

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
      { url: `${BASE}/kupony/${shop.slug}` },
    ];
    return urls;
  });

  const categoryUrls: MetadataRoute.Sitemap = TAXONOMY_LIST.map(c => ({
    url: `${BASE}/kategoria/${c.id}`,
  }));

  const letakyUrls: MetadataRoute.Sitemap = LETAKY.map(l => ({
    url: `${BASE}/letaky/${l.slug}`,
  }));

  let articleUrls: MetadataRoute.Sitemap = [];
  try {
    const articles = await getPublishedArticles();
    articleUrls = articles.map(a => ({
      url: `${BASE}/akcie/${a.slug}`,
      lastModified: new Date(a.updatedAt || a.date),
    }));
  } catch {}

  return [
    { url: BASE },
    { url: `${BASE}/obchody` },
    { url: `${BASE}/kupony` },
    { url: `${BASE}/akcie` },
    { url: `${BASE}/letaky` },
    { url: `${BASE}/kategoria` },
    { url: `${BASE}/o-nas` },
    { url: `${BASE}/inzercia` },
    { url: `${BASE}/privacy` },

    ...categoryUrls,
    ...letakyUrls,
    ...articleUrls,
    ...shopUrls,
  ];
}
