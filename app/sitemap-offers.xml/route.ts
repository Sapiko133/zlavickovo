import { sitemapRoute } from "@/lib/seo/sitemap";

export const revalidate = 3600;

export function GET() {
  return sitemapRoute("offers");
}
