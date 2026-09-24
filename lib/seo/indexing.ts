/**
 * Indexačná politika — JEDINÉ miesto, ktoré rozhoduje index/noindex pre
 * programatické šablóny. Rovnaké funkcie volá stránka (meta robots) aj sitemap,
 * takže URL v sitemap je vždy indexovateľná a naopak.
 *
 * | Šablóna              | index keď                                             | inak                    |
 * |----------------------|-------------------------------------------------------|-------------------------|
 * | /kupony/[obchod]     | ≥1 aktívna ponuka (kód/akcia/článok) ALEBO TOP obchod | noindex,follow + mimo SM|
 * | /kupony/[obchod]-cz  | nikdy samostatne — canonical na /kupony/[obchod]      |                         |
 * | /kategoria/[id]      | ≥3 obchody ALEBO ≥1 aktívna ponuka                    | noindex,follow          |
 * | /akcie/[slug] (sale) | aktívna, nie duplikát                                 | ukončená: noindex →     |
 * |                      |                                                       | po 30 dňoch 308 obchod  |
 * | /akcie/[slug] (tip)  | vždy (evergreen)                                      |                         |
 * | /kupony?page=N       | N ≤ počet strán, bez filtrov                          | filtre noindex; N>max 404|
 * | /hladat, filtre      | nikdy                                                 | noindex,follow          |
 */
import type { Article } from "@/lib/articles";
import { isOfferActive } from "@/lib/offers/freshness";
import { TOP_SLUGS } from "./shop-registry";

export interface IndexDecision {
  index: boolean;
  reason: string;
}

/** Aktívnosť kupónu/akcie v zjednotenom tvare getCouponsByShop (rôzne siete = rôzne polia). */
export function isShopOfferActive(c: { valid_to?: unknown; validTo?: unknown; endDate?: unknown; expires?: unknown }): boolean {
  const raw = (c.valid_to ?? c.validTo ?? c.endDate ?? c.expires ?? null) as string | null;
  return isOfferActive(raw);
}

export function shopIndexDecision(input: { slug: string; activeOffers: number; isCzVariant?: boolean }): IndexDecision {
  if (input.isCzVariant) return { index: false, reason: "cz-variant (canonical na základný obchod)" };
  if (input.activeOffers > 0) return { index: true, reason: `${input.activeOffers} aktívnych ponúk` };
  if (TOP_SLUGS.includes(input.slug)) return { index: true, reason: "kurátorský TOP obchod" };
  return { index: false, reason: "žiadna aktívna ponuka (thin)" };
}

export const CATEGORY_MIN_SHOPS = 3;

export function categoryIndexDecision(input: { shopCount: number; activeOffers: number }): IndexDecision {
  if (input.shopCount >= CATEGORY_MIN_SHOPS) return { index: true, reason: `${input.shopCount} obchodov` };
  if (input.activeOffers > 0) return { index: true, reason: `${input.activeOffers} aktívnych ponúk` };
  return { index: false, reason: "prázdna kategória" };
}

// ─── Životný cyklus ponuky (/akcie/[slug]) ──────────────────────────────────

/** Ako dlho ostáva ukončená akcia dostupná ako historická stránka (noindex) pred 308. */
export const EXPIRED_OFFER_GRACE_DAYS = 30;

export type ArticleLifecycle =
  | { state: "active" }
  | { state: "expired"; endedAt: string | null }
  | { state: "gone"; endedAt: string | null };

export function articleLifecycle(a: Pick<Article, "type" | "published" | "validTo" | "updatedAt">, now = Date.now()): ArticleLifecycle {
  if (a.type === "tip") return { state: "active" };
  const expiredByDate = a.validTo ? !isOfferActive(a.validTo, now) : false;
  if (a.published && !expiredByDate) return { state: "active" };
  const endedAt = a.validTo ?? a.updatedAt ?? null;
  const endedMs = endedAt ? Date.parse(endedAt) : NaN;
  if (Number.isFinite(endedMs) && now - endedMs > EXPIRED_OFFER_GRACE_DAYS * 86400_000) {
    return { state: "gone", endedAt };
  }
  return { state: "expired", endedAt };
}

export function isArticleIndexable(a: Pick<Article, "type" | "published" | "validTo" | "updatedAt">): boolean {
  return articleLifecycle(a).state === "active";
}

/** Normalizovaný titulok na detekciu duplicitných ponúk (rovnaký obchod + rovnaký text). */
export function articleDedupeKey(a: Pick<Article, "shopSlug" | "shopName" | "title">): string {
  const shop = (a.shopSlug || a.shopName || "").toLowerCase();
  const title = a.title
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/^[^:]{1,40}:\s*/, "") // "Tchibo.sk: Ladies" → "ladies"
    .replace(/[^a-z0-9%]+/g, " ")
    .trim();
  return `${shop}|${title}`;
}

/**
 * Kanonický článok pre skupinu duplicitných aktívnych ponúk: najstarší
 * (prvý publikovaný drží históriu), pri zhode abecedne podľa slugu.
 * Vracia mapu slug → kanonický slug (len pre duplikáty).
 */
export function duplicateArticleCanonicals(articles: Article[]): Map<string, string> {
  const groups = new Map<string, Article[]>();
  for (const a of articles) {
    if (a.type !== "sale" || !isArticleIndexable(a)) continue;
    const k = articleDedupeKey(a);
    groups.set(k, [...(groups.get(k) ?? []), a]);
  }
  const out = new Map<string, string>();
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    list.sort((x, y) => x.date.localeCompare(y.date) || x.slug.localeCompare(y.slug));
    for (const a of list.slice(1)) out.set(a.slug, list[0].slug);
  }
  return out;
}
