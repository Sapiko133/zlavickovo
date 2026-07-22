import { buildServerHeurekaSearchUrl } from "@/lib/heureka/affiliate";
import { getSalesCoupons } from "@/lib/dognet";
import { dognetCouponToAkcia } from "@/lib/akcie";
import { getPublishedArticles } from "@/lib/articles";
import { normalizeShopSlug } from "@/lib/slug";
import type { ClickType } from "@/lib/click-types";

/**
 * Unifikovaný zoznam výpredajov pre /akcie (štýl a la vasekupony.sk/vypredaje).
 * Zdroje:
 *  1. Veľké obchody (BIG_SHOPS) — CTA vedie CEZ HEUREKU (haff, monetizované),
 *     lebo na ne nemáme priamy affiliate.
 *  2. Dognet výpredaje (getSalesCoupons) — reálne % + affiliate tracking link.
 *  3. Affial partnerské články (STATIC_SALE_ARTICLES) — interný odkaz na článok.
 */

export interface VypredajItem {
  id: string;
  shopName: string;
  domain: string;
  shopSlug: string;
  title: string;
  badge: string;        // "-30%" alebo "VÝPREDAJ"
  hasPct: boolean;
  meta: string;         // "platí priebežne" / "platí do DD.MM.YYYY"
  ctaUrl: string;
  external: boolean;    // true → target _blank (Heureka/affiliate)
  clickType: ClickType;
  source: "heureka" | "dognet" | "affial";
}

// Veľké obchody + reprezentatívny Heureka dopyt (kategória), na ktorý sa CTA otvorí.
const BIG_SHOPS: { name: string; domain: string; slug: string; q: string }[] = [
  { name: "Alza",       domain: "alza.sk",       slug: "alza",       q: "notebook" },
  { name: "Datart",     domain: "datart.sk",     slug: "datart",     q: "televízor" },
  { name: "Mall",       domain: "mall.sk",       slug: "mall",       q: "elektronika" },
  { name: "NAY",        domain: "nay.sk",        slug: "nay",        q: "práčka" },
  { name: "Zalando",    domain: "zalando.sk",    slug: "zalando",    q: "oblečenie výpredaj" },
  { name: "About You",  domain: "aboutyou.sk",   slug: "about-you",  q: "oblečenie" },
  { name: "Answear",    domain: "answear.sk",    slug: "answear",    q: "oblečenie" },
  { name: "H&M",        domain: "hm.com",        slug: "hm",         q: "oblečenie" },
  { name: "Nike",       domain: "nike.com",      slug: "nike",       q: "tenisky nike" },
  { name: "Adidas",     domain: "adidas.com",    slug: "adidas",     q: "tenisky adidas" },
  { name: "Sportisimo", domain: "sportisimo.sk", slug: "sportisimo", q: "tenisky" },
  { name: "Decathlon",  domain: "decathlon.sk",  slug: "decathlon",  q: "športové potreby" },
  { name: "Notino",     domain: "notino.sk",     slug: "notino",     q: "parfém" },
  { name: "Dr. Max",    domain: "drmax.sk",      slug: "dr-max",     q: "vitamíny" },
  { name: "GymBeam",    domain: "gymbeam.sk",    slug: "gymbeam",    q: "proteín" },
  { name: "Martinus",   domain: "martinus.sk",   slug: "martinus",   q: "knihy" },
];

function bigShopItems(): VypredajItem[] {
  return BIG_SHOPS.map((s) => ({
    id: `heureka-${s.slug}`,
    shopName: s.name,
    domain: s.domain,
    shopSlug: s.slug,
    title: `Výpredaj a najlepšie ceny – ${s.name}`,
    badge: "VÝPREDAJ",
    hasPct: false,
    meta: "porovnaj ceny na Heureke",
    ctaUrl: buildServerHeurekaSearchUrl(s.q),
    external: true,
    clickType: "heureka_fallback",
    source: "heureka",
  }));
}

async function articleItems(): Promise<VypredajItem[]> {
  const articles = await getPublishedArticles("sale").catch(() => []);
  return articles.map((a) => {
    const aff = a.affiliateUrl?.startsWith("http") ? a.affiliateUrl : "";
    const meta = a.validTo
      ? `platí do ${new Date(a.validTo).toLocaleDateString("sk-SK")}`
      : "priebežná akcia";
    return {
      id: `article-${a.slug}`,
      shopName: a.shopName || "",
      domain: a.domain || "",
      shopSlug: a.shopSlug || normalizeShopSlug(a.shopName || ""),
      title: a.title,
      badge: a.discountPct ? `-${a.discountPct}%` : "VÝPREDAJ",
      hasPct: !!a.discountPct,
      meta,
      // priamy affiliate klik ak ho máme, inak interný článok
      ctaUrl: aff || `/akcie/${a.slug}`,
      external: !!aff,
      clickType: "action_outbound",
      source: "affial",
    };
  });
}

async function dognetItems(): Promise<VypredajItem[]> {
  try {
    const sales = await getSalesCoupons(30);
    return sales
      .filter((c: any) => c.campaign?.name)
      .map((c: any) => dognetCouponToAkcia(c))
      .filter((a) => a.affiliateUrl?.startsWith("http"))
      .map((a) => {
        const pct = /^-?\d+%$/.test(a.badge || "") || /-\d+%/.test(a.badge || "");
        return {
          id: a.id,
          shopName: a.shopName,
          domain: a.domain,
          shopSlug: normalizeShopSlug(a.shopName),
          title: a.title,
          badge: a.badge || "VÝPREDAJ",
          hasPct: !!pct && a.badge !== "AKCIA",
          meta: a.validTo ? `platí do ${new Date(a.validTo).toLocaleDateString("sk-SK")}` : "platí priebežne",
          ctaUrl: a.affiliateUrl,
          external: true,
          clickType: "action_outbound" as ClickType,
          source: "dognet" as const,
        };
      });
  } catch {
    return [];
  }
}

export interface VypredajeData {
  featured: VypredajItem[];
  items: VypredajItem[];
  total: number;
}

export async function getVypredaje(): Promise<VypredajeData> {
  const [dognet, articles] = await Promise.all([dognetItems(), articleItems()]);
  const big = bigShopItems();

  // Dedup podľa shopSlug — Dognet (reálne %) > články (scrape/affial) > Heureka veľké obchody
  const seen = new Set<string>();
  const all: VypredajItem[] = [];
  for (const it of [...dognet, ...articles, ...big]) {
    const key = it.shopSlug || it.id;
    if (seen.has(key)) continue;
    seen.add(key);
    all.push(it);
  }

  // Featured = položky s reálnym % (Dognet) hore, doplnené veľkými obchodmi
  const withPct = all.filter((i) => i.hasPct);
  const featured = [...withPct, ...big].slice(0, 6);

  return { featured, items: all, total: all.length };
}
