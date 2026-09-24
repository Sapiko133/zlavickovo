import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo/config";

/**
 * Crawl budget: blokujeme admin, interné API, interné vyhľadávanie a
 * parametrické kombinácie (filtre, zoradenie, tracking). Stránkovanie
 * (?page=N) ostáva prístupné. CSS/JS (_next/static) a obrázky (vrátane
 * proxy /api/img pre bannery inzerentov) NEblokujeme — Google ich potrebuje na rendering.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/api/img"],
        disallow: [
          "/api/",
          "/admin",
          "/hladat",
          "/*?q=", "/*&q=",
          "/*?sort=", "/*&sort=",
          "/*?cat=", "/*&cat=",
          "/*?utm_", "/*&utm_",
          "/*?gclid=", "/*&gclid=",
          "/*?fbclid=", "/*&fbclid=",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
