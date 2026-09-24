import { renderSitemapIndex, xmlResponse } from "@/lib/seo/sitemap";

// Sitemap index — URL /sitemap.xml ostáva (Search Console, robots.txt), obsah sa delí podľa typu.
export const revalidate = 3600;

export function GET() {
  return xmlResponse(renderSitemapIndex());
}
