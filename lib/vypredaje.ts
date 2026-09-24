import { getAffiliateActions } from "@/lib/affiliate-actions";
import { getPublishedArticles } from "@/lib/articles";
import { getShopDomain } from "@/lib/shop-domains";
import { normalizeShopSlug } from "@/lib/slug";
import type { ClickType } from "@/lib/click-types";
import { duplicateArticleCanonicals, isArticleIndexable } from "@/lib/seo/indexing";
import { getShopRegistry, resolveShopSlugSync } from "@/lib/seo/shop-registry";

export interface VypredajItem {
  id: string;
  shopName: string;
  domain: string;
  shopSlug: string;
  /** Interný odkaz na /kupony/[slug] — null, ak obchod nemá stránku (žiadne odkazy na 404). */
  shopHref: string | null;
  title: string;
  badge: string;
  hasPct: boolean;
  meta: string;
  ctaUrl: string;
  detailUrl?: string;
  imageUrl?: string;
  imageSource?: string;
  actionKey?: string;
  /** actionKey duplicitných článkov, ktoré majú canonical na tento článok. */
  aliasActionKeys?: string[];
  external: boolean;
  clickType: ClickType;
  source: "dognet" | "affial" | "ehub" | "cj" | "editorial" | "static";
}

function pctBadge(text: string) {
  const match = text.match(/(?:až\s*)?-?\s*(\d{1,2})\s*%/i);
  return match ? `-${match[1]}%` : "AKCIA";
}

function validMeta(validTo?: string | null) {
  if (!validTo) return "aktuálna ponuka";
  const date = new Date(validTo);
  return Number.isNaN(date.getTime()) ? "aktuálna ponuka" : `platí do ${date.toLocaleDateString("sk-SK")}`;
}

async function affiliateItems(): Promise<VypredajItem[]> {
  const actions = await getAffiliateActions();
  return actions.map((action) => {
    const badge = pctBadge(action.title);
    return {
      id: `${action.source}-${action.sourceId}`,
      actionKey: action.actionKey,
      shopName: action.shopName,
      domain: action.domain,
      shopSlug: action.shopSlug,
      shopHref: null,
      title: action.title,
      badge,
      hasPct: badge !== "AKCIA",
      meta: validMeta(action.validTo),
      ctaUrl: action.affiliateUrl,
      external: true,
      clickType: "action_outbound" as const,
      source: action.source,
    };
  });
}

async function articleItems(): Promise<VypredajItem[]> {
  // Ukončené akcie (validTo v minulosti) sa nezobrazujú ako aktuálne, aj keď cron ešte nebežal.
  // Duplikáty (rovnaká ponuka pod 2 slugmi) vynechané — zobrazí sa kanonický originál.
  const published = await getPublishedArticles("sale").catch(() => []);
  const dup = duplicateArticleCanonicals(published);
  const articles = published.filter((a) => isArticleIndexable(a) && !dup.has(a.slug));
  const aliasKeys = new Map<string, string[]>();
  for (const a of published) {
    const canonical = dup.get(a.slug);
    if (canonical && a.actionKey) aliasKeys.set(canonical, [...(aliasKeys.get(canonical) ?? []), a.actionKey]);
  }
  return articles.map((article) => ({
    aliasActionKeys: aliasKeys.get(article.slug),
    id: `editorial-${article.slug}`,
    shopName: article.shopName || "Obchod",
    domain: article.domain || getShopDomain(article.shopName || "") || "",
    shopSlug: article.shopSlug || normalizeShopSlug(article.shopName || ""),
    shopHref: null,
    title: article.title,
    badge: article.discountPct ? `-${article.discountPct}%` : "AKCIA",
    hasPct: Boolean(article.discountPct),
    meta: validMeta(article.validTo),
    ctaUrl: `/akcie/${article.slug}`,
    // Reálny obrázok inzerenta (banner/og/logo), NIE generovaná grafika.
    imageUrl: article.imageUrl,
    imageSource: article.imageSource,
    external: false,
    clickType: "action_outbound" as const,
    source: "editorial" as const,
    actionKey: article.actionKey,
  }));
}

export interface VypredajeData { featured: VypredajItem[]; items: VypredajItem[]; total: number }

export async function getVypredaje(): Promise<VypredajeData> {
  const [affiliate, articles, reg] = await Promise.all([affiliateItems(), articleItems(), getShopRegistry()]);
  for (const item of [...affiliate, ...articles]) {
    const slug = resolveShopSlugSync(reg, { slug: item.shopSlug, name: item.shopName, domain: item.domain });
    if (slug) item.shopSlug = slug;
    item.shopHref = slug ? `/kupony/${slug}` : null;
  }
  const articleByAction = new Map(
    articles.filter((article) => article.actionKey).map((article) => [article.actionKey as string, article]),
  );
  // Affiliate akcia duplicitného článku vedie na jeho kanonický článok (inak by originál osirel).
  for (const article of articles) {
    for (const k of article.aliasActionKeys ?? []) if (!articleByAction.has(k)) articleByAction.set(k, article);
  }
  // Párovanie affiliate akcie s článkom: actionKey → rovnaký obchod+text → prvý článok obchodu.
  // Zhoda podľa textu je nutná, inak by článok, ktorého affiliate dvojča sa pri dedupe
  // nižšie zahodí, nemal žiadny interný odkaz (osirelá stránka).
  const keyOf = (i: { shopSlug: string; title: string }) => `${i.shopSlug}|${i.title.toLocaleLowerCase("sk")}`;
  const articleByKey = new Map(articles.map((article) => [keyOf(article), article]));
  const articleByShop = new Map(articles.map((article) => [article.shopSlug, article]));
  const linkedAffiliate = affiliate.map((item) => {
    const linked =
      (item.actionKey ? articleByAction.get(item.actionKey) : undefined) ||
      articleByKey.get(keyOf(item)) ||
      articleByShop.get(item.shopSlug);
    return {
      ...item,
      detailUrl: linked?.ctaUrl,
      // Reálny obrázok z prepojeného článku (banner/og/logo), NIE generovaná grafika.
      imageUrl: linked?.imageUrl,
      imageSource: linked?.imageSource,
    };
  });
  const seen = new Set<string>();
  const seenActions = new Set<string>();
  const items = [...linkedAffiliate, ...articles].filter((item) => {
    if (item.actionKey) {
      if (seenActions.has(item.actionKey)) return false;
      seenActions.add(item.actionKey);
    }
    const key = `${item.shopSlug}|${item.title.toLocaleLowerCase("sk")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  items.sort((a, b) => Number(b.hasPct) - Number(a.hasPct) || a.shopName.localeCompare(b.shopName, "sk"));
  return { featured: items.slice(0, 6), items, total: items.length };
}
