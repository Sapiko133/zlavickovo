import { MetadataRoute } from "next";
import { getShops } from "@/lib/dognet";
import { CATEGORIES } from "@/lib/categories";
import { AFFIAL_SHOPS } from "@/lib/affial-shops";
import { AFFIAL_COUPONS } from "@/lib/affial-coupons";
import { getAllPosts } from "@/lib/blog";
import { LETAKY } from "@/lib/letaky";
import { normalizeShopSlug } from "@/lib/slug";
import { getTopProductIds, toProductSlug } from "@/lib/heureka/query";

export const revalidate = 3600;

const BASE = "https://www.zlavickovo.sk";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let shops: { id: number; name: string; count: number }[] = [];
  try { shops = await getShops(); } catch {}

  // Dognet shop slugs (deduplicated set for later use)
  const dognetSlugs = new Set(shops.map(s => normalizeShopSlug(s.name)));

  const shopUrls = shops.flatMap(shop => {
    const sl = normalizeShopSlug(shop.name);
    return [
      { url: `${BASE}/kupony/${sl}`, lastModified: new Date(), changeFrequency: "daily" as const, priority: 0.8 },
      { url: `${BASE}/kupony/${sl}-cz`, lastModified: new Date(), changeFrequency: "daily" as const, priority: 0.7 },
    ];
  });

  // Affial shop slugs not already in Dognet
  const affialShopSlugs = new Set<string>();
  const affialShopUrls: MetadataRoute.Sitemap = [];
  for (const s of AFFIAL_SHOPS) {
    const sl = s.domain.replace(/\.(sk|cz|eu|com|net)$/, "").replace(/\./g, "-");
    if (!dognetSlugs.has(sl) && !affialShopSlugs.has(sl)) {
      affialShopSlugs.add(sl);
      affialShopUrls.push({ url: `${BASE}/kupony/${sl}`, lastModified: new Date(), changeFrequency: "daily", priority: 0.7 });
    }
  }

  // Affial coupon shop slugs not already covered
  const affialCouponUrls: MetadataRoute.Sitemap = [];
  for (const c of AFFIAL_COUPONS) {
    const sl = c.domain.replace(/\.(sk|cz|eu|com|net)$/, "").replace(/\./g, "-");
    if (!dognetSlugs.has(sl) && !affialShopSlugs.has(sl)) {
      affialShopSlugs.add(sl);
      affialCouponUrls.push({ url: `${BASE}/kupony/${sl}`, lastModified: new Date(), changeFrequency: "daily", priority: 0.6 });
    }
  }

  const categoryUrls: MetadataRoute.Sitemap = Object.keys(CATEGORIES).map(catSlug => ({
    url: `${BASE}/kategoria/${catSlug}`,
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

  let blogUrls: MetadataRoute.Sitemap = [];
  try {
    const posts = getAllPosts();
    blogUrls = posts.map(p => ({
      url: `${BASE}/blog/${p.slug}`,
      lastModified: new Date(p.date),
      changeFrequency: "monthly" as const,
      priority: 0.5,
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

    { url: `${BASE}/blog`,          lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    ...categoryUrls,
    ...letakyUrls,
    ...blogUrls,
    ...shopUrls,
    ...affialShopUrls,
    ...affialCouponUrls,
    ...productUrls,
  ];
}
