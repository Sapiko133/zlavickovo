import { redis } from "@/lib/redis";
import { getAllPosts, type BlogPost } from "@/lib/blog";
import { STATIC_SALE_ARTICLES } from "@/lib/static-articles";

/**
 * Jednotný článkový systém (merge blog + akcie).
 * - type "sale": automaticky generované (cron) alebo manuálne články o výpredaji
 *   jedného obchodu — grid zľavnených produktov + affiliate CTA + kupóny obchodu.
 * - type "tip": evergreen články (návody, tipy). Sem patria aj staré content/blog/*.json.
 *
 * Úložisko: Redis hash `articles` (field = slug, value = Article JSON).
 * Staré content/blog/*.json sa čítajú ako read-only "tip" fallback (žiadna strata).
 */

const ARTICLES_KEY = "articles";

export type ArticleType = "sale" | "tip";

export interface SaleProduct {
  name: string;
  imgUrl: string;
  oldPrice?: number | null; // pôvodná cena (len ak máme cenovú históriu)
  newPrice: number | null;  // aktuálna cena
  currency: string;         // "EUR" | "CZK"
  affiliateUrl: string;     // affiliate odkaz na produkt
}

export interface Article {
  slug: string;
  type: ArticleType;
  title: string;
  perex: string;            // krátky popis do gridu / meta description
  content?: string;         // HTML (manuálne / tip články)
  imageUrl?: string;        // og:image (prvý produkt / manuálne)
  shopName?: string;
  domain?: string;
  shopSlug?: string;
  discountPct?: number | null;
  products?: SaleProduct[];
  affiliateUrl?: string;    // "Prejsť na výpredaj" CTA
  date: string;             // ISO publikačný dátum
  updatedAt: string;        // ISO
  published: boolean;
  source: "auto" | "manual";
  validTo?: string | null;  // akcia skončila → published=false
}

/** Staré blogové posty (súborové) → Article (type "tip"), read-only. */
function postToArticle(p: BlogPost): Article {
  return {
    slug: p.slug,
    type: "tip",
    title: p.title,
    perex: p.description,
    content: p.content,
    shopName: p.shop || undefined,
    date: p.date,
    updatedAt: p.date,
    published: true,
    source: "manual",
  };
}

function legacyTipArticles(): Article[] {
  try {
    return getAllPosts().map(postToArticle);
  } catch {
    return [];
  }
}

async function readRedisArticles(): Promise<Article[]> {
  try {
    const map = await redis.hgetall<Record<string, Article>>(ARTICLES_KEY);
    if (!map) return [];
    return Object.values(map).filter((a): a is Article => !!a && typeof a === "object" && !!a.slug);
  } catch {
    return [];
  }
}

/**
 * Všetky články, poradie priority (nižšie prepíše vyššie pri zhode slugu):
 * legacy súborový blog (tip) < kurátorské STATIC_SALE_ARTICLES (sale) < Redis (auto/manuál).
 */
export async function getAllArticles(): Promise<Article[]> {
  const redisArticles = await readRedisArticles();
  const bySlug = new Map<string, Article>();
  for (const a of legacyTipArticles()) bySlug.set(a.slug, a);
  for (const a of STATIC_SALE_ARTICLES) bySlug.set(a.slug, a);
  for (const a of redisArticles) bySlug.set(a.slug, a);
  return Array.from(bySlug.values()).sort((a, b) => b.date.localeCompare(a.date));
}

/** Publikované články, voliteľne filtrované podľa typu. */
export async function getPublishedArticles(type?: ArticleType): Promise<Article[]> {
  const all = await getAllArticles();
  return all.filter((a) => a.published && (!type || a.type === type));
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  try {
    const a = await redis.hget<Article>(ARTICLES_KEY, slug);
    if (a && typeof a === "object" && a.slug) return a;
  } catch {}
  const staticSale = STATIC_SALE_ARTICLES.find((a) => a.slug === slug);
  if (staticSale) return staticSale;
  const legacy = legacyTipArticles().find((a) => a.slug === slug);
  return legacy ?? null;
}

export async function saveArticle(article: Article): Promise<void> {
  await redis.hset(ARTICLES_KEY, { [article.slug]: article });
}

export async function deleteArticle(slug: string): Promise<void> {
  await redis.hdel(ARTICLES_KEY, slug);
}

/** Najnovšie publikované články (pre homepage grid), voliteľne podľa typu. */
export async function latestArticles(limit = 12, type?: ArticleType): Promise<Article[]> {
  const published = await getPublishedArticles(type);
  return published.slice(0, limit);
}
