import { getAffiliateActions } from "@/lib/affiliate-actions";
import { getPublishedArticles } from "@/lib/articles";
import { getShopDomain } from "@/lib/shop-domains";
import { normalizeShopSlug } from "@/lib/slug";
import type { ClickType } from "@/lib/click-types";

export interface VypredajItem {
  id: string;
  shopName: string;
  domain: string;
  shopSlug: string;
  title: string;
  badge: string;
  hasPct: boolean;
  meta: string;
  ctaUrl: string;
  detailUrl?: string;
  imageUrl?: string;
  actionKey?: string;
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
  const articles = await getPublishedArticles("sale").catch(() => []);
  return articles.map((article) => ({
    id: `editorial-${article.slug}`,
    shopName: article.shopName || "Obchod",
    domain: article.domain || getShopDomain(article.shopName || "") || "",
    shopSlug: article.shopSlug || normalizeShopSlug(article.shopName || ""),
    title: article.title,
    badge: article.discountPct ? `-${article.discountPct}%` : "AKCIA",
    hasPct: Boolean(article.discountPct),
    meta: validMeta(article.validTo),
    ctaUrl: `/akcie/${article.slug}`,
    imageUrl: `/akcie/${article.slug}/opengraph-image`,
    external: false,
    clickType: "action_outbound" as const,
    source: "editorial" as const,
    actionKey: article.actionKey,
  }));
}

export interface VypredajeData { featured: VypredajItem[]; items: VypredajItem[]; total: number }

export async function getVypredaje(): Promise<VypredajeData> {
  const [affiliate, articles] = await Promise.all([affiliateItems(), articleItems()]);
  const articleByAction = new Map(
    articles.filter((article) => article.actionKey).map((article) => [article.actionKey as string, article.ctaUrl]),
  );
  const articleByShop = new Map(articles.map((article) => [article.shopSlug, article.ctaUrl]));
  const linkedAffiliate = affiliate.map((item) => {
    const detailUrl = (item.actionKey ? articleByAction.get(item.actionKey) : undefined) || articleByShop.get(item.shopSlug);
    return {
      ...item,
      detailUrl,
      imageUrl: detailUrl ? `${detailUrl}/opengraph-image` : undefined,
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
