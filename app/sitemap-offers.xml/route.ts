import { sitemapRoute } from "@/lib/seo/sitemap";

// Dynamicky (nie prerender pri builde — build nemusí mať živé zdroje); CDN cache cez Cache-Control.
export const dynamic = "force-dynamic";

export function GET() {
  return sitemapRoute("offers");
}
