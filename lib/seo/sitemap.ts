/**
 * Sitemap systém — index + sitemapy podľa typu obsahu:
 *   /sitemap.xml              sitemapindex
 *   /sitemap-pages.xml        hub stránky + letáky
 *   /sitemap-shops.xml        /kupony/[obchod]   (len indexovateľné podľa shopIndexDecision)
 *   /sitemap-categories.xml   /kategoria/[id]    (len indexovateľné podľa categoryIndexDecision)
 *   /sitemap-offers.xml       /akcie/[slug]      (aktívne, nie duplikáty; tip články)
 *
 * Do sitemap ide LEN kanonická, indexovateľná URL s reálnym obsahom —
 * rovnaké funkcie rozhodujú aj o meta robots na stránke.
 */
import { getAllArticles, type Article } from "@/lib/articles";
import { LETAKY } from "@/lib/letaky";
import { isAdultShop } from "@/lib/shop-categories";
import { TAXONOMY_LIST } from "@/lib/taxonomy";
import { SITE_URL, absoluteUrl } from "./config";
import { buildCategoryShops } from "./category-shops";
import { categoryIndexDecision, duplicateArticleCanonicals, isArticleIndexable } from "./indexing";
import { getShopSeoIndex } from "./shop-index";
import { getShopRegistry } from "./shop-registry";

export interface SitemapEntry {
  url: string;
  lastModified?: string;
}

export const SITEMAP_TYPES = ["pages", "shops", "categories", "offers"] as const;
export type SitemapType = (typeof SITEMAP_TYPES)[number];

const STATIC_PAGES = ["/", "/akcie", "/kupony", "/obchody", "/kategoria", "/letaky", "/o-nas", "/inzercia", "/privacy"];

function isoDate(v: string | undefined | null): string | undefined {
  if (!v) return undefined;
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : undefined;
}

export async function sitemapEntries(type: SitemapType): Promise<SitemapEntry[]> {
  switch (type) {
    case "pages":
      return [
        ...STATIC_PAGES.map((p) => ({ url: absoluteUrl(p) })),
        ...LETAKY.map((l) => ({ url: absoluteUrl(`/letaky/${l.slug}`) })),
      ];

    case "shops": {
      const index = await getShopSeoIndex();
      // Erotické / 18+ obchody nechávame mimo sitemap (stránky ostávajú dostupné)
      return index
        .filter((s) => s.index && !isAdultShop({ slug: s.slug, name: s.name }))
        .map((s) => ({ url: absoluteUrl(`/kupony/${s.slug}`) }));
    }

    case "categories": {
      const [reg, index] = await Promise.all([getShopRegistry(), getShopSeoIndex()]);
      return TAXONOMY_LIST.filter((cat) => {
        const shops = buildCategoryShops(cat, reg, index);
        const offers = shops.reduce((n, s) => n + s.offers, 0);
        return categoryIndexDecision({ shopCount: shops.length, activeOffers: offers }).index;
      }).map((cat) => ({ url: absoluteUrl(`/kategoria/${cat.id}`) }));
    }

    case "offers": {
      const articles = await getAllArticles().catch(() => [] as Article[]);
      const dup = duplicateArticleCanonicals(articles.filter((a) => a.published));
      return articles
        .filter((a) => a.published && isArticleIndexable(a) && !dup.has(a.slug))
        .map((a) => ({ url: absoluteUrl(`/akcie/${a.slug}`), lastModified: isoDate(a.updatedAt || a.date) }));
    }
  }
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export function renderUrlset(entries: SitemapEntry[]): string {
  const seen = new Set<string>();
  const rows: string[] = [];
  for (const e of entries) {
    if (seen.has(e.url) || !e.url.startsWith(SITE_URL)) continue;
    seen.add(e.url);
    rows.push(`  <url>\n    <loc>${xmlEscape(e.url)}</loc>${e.lastModified ? `\n    <lastmod>${e.lastModified}</lastmod>` : ""}\n  </url>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join("\n")}\n</urlset>\n`;
}

/** Index bez <lastmod> — nemáme spoľahlivý dátum zmeny celej podmapy a falošný "now" Google ignoruje. */
export function renderSitemapIndex(): string {
  const rows = SITEMAP_TYPES.map((t) => `  <sitemap>\n    <loc>${SITE_URL}/sitemap-${t}.xml</loc>\n  </sitemap>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join("\n")}\n</sitemapindex>\n`;
}

export function xmlResponse(body: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

/** Handler pre /sitemap-{type}.xml — pri chybe zdroja radšej 503 než prázdna sitemap (Google by URL vyradil). */
export async function sitemapRoute(type: SitemapType): Promise<Response> {
  try {
    const entries = await sitemapEntries(type);
    // Poistka: radšej 503 (Google skúsi neskôr) než orezaná sitemap, ktorá by vyradila URL.
    if ((entries.length === 0 && type !== "offers") || (type === "shops" && entries.length < 100)) {
      return new Response("sitemap temporarily unavailable", { status: 503, headers: { "Retry-After": "600" } });
    }
    return xmlResponse(renderUrlset(entries));
  } catch (e) {
    console.error(`[sitemap] ${type}:`, e);
    return new Response("sitemap temporarily unavailable", { status: 503, headers: { "Retry-After": "600" } });
  }
}
