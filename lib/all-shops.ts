import { redis } from "@/lib/redis";
import { getShops as getDognetShops } from "@/lib/dognet";
import { getEhubShops, type EhubShop } from "@/lib/ehub";
import { getCjShops, type CjShop } from "@/lib/cj";
import { AFFIAL_SHOPS } from "@/lib/affial-shops";
import { AFFIAL_COUPONS } from "@/lib/affial-coupons";
import { TOP_SHOPS } from "@/lib/top-shops";
import { normalizeShopName, normalizeShopSlug } from "@/lib/slug";
import { getShopDomain } from "@/lib/shop-domains";
import { getStaticShops, getStaticEhubShops } from "@/lib/static-data";
import { compareShopsByPriority, getShopPriority } from "@/lib/shop-priority";

/**
 * Jediný zdroj pravdy pre všetky obchody na webe.
 * Konzumenti: autocomplete (app/api/autocomplete), /obchody, sitemap,
 * generateStaticParams na /kupony/[slug].
 *
 * Kanonický slug = normalizeShopSlug(name) — rovnaký tvar generuje
 * autocomplete aj shop stránka, takže každý obchod v zozname je dostupný
 * na /kupony/[slug].
 */

export type KnownShopSource =
  | "top"
  | "dognet"
  | "ehub"
  | "cj"
  | "affial"
  | "affial-coupon";

export interface KnownShop {
  name: string;
  /** Kanonický URL slug — /kupony/[slug] */
  slug: string;
  /** Doména obchodu, "" ak neznáma */
  domain: string;
  category: string;
  /** Zdroj s najvyššou prioritou, z ktorého obchod pochádza */
  source: KnownShopSource;
  /** Počet kupónov (Dognet) */
  count?: number;
  commission?: string;
  logoUrl?: string;
}

const CACHE_KEY = "shops:known:v2"; // v2: krajinská priorita pri norm-kolízii
const CACHE_TTL = 86400; // 24 hodín

const AFFIAL_CAT_LABELS: Record<string, string> = {
  zdravie: "Zdravie", krasa: "Krása", byvanie: "Bývanie",
  moda: "Móda", sport: "Šport", deti: "Deti", ine: "Iné",
  elektronika: "Elektronika", potraviny: "Potraviny",
  cestovanie: "Cestovanie", knihy: "Knihy",
};

function webToDomain(web: string): string {
  try {
    const url = web.startsWith("http") ? web : `https://${web}`;
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return web.replace(/^www\./, "");
  }
}

interface ShopInput {
  name: string;
  slug?: string;
  domain?: string;
  category?: string;
  source: KnownShopSource;
  count?: number;
  commission?: string;
  logoUrl?: string;
}

/**
 * Zbiera obchody zo zdrojov v poradí priority. Duplicitný obchod
 * (rovnaký slug alebo rovnaký normalizovaný názov — "Dr. Max" vs "Dr.Max")
 * existujúci záznam len obohatí o chýbajúce polia, nikdy neprepíše
 * meno/slug zo zdroja s vyššou prioritou.
 */
class ShopCollector {
  private bySlug = new Map<string, KnownShop>();
  private slugByNorm = new Map<string, string>();

  add(input: ShopInput) {
    const name = (input.name ?? "").trim();
    if (!name) return;
    const norm = normalizeShopName(name);
    const slug =
      input.slug ||
      normalizeShopSlug(name) ||
      (input.domain ? normalizeShopSlug(input.domain) : "");
    if (!slug) return;

    const domain = (input.domain || getShopDomain(name) || "").toLowerCase();
    const existingSlug = this.bySlug.has(slug)
      ? slug
      : (norm ? this.slugByNorm.get(norm) : undefined);

    if (existingSlug) {
      const e = this.bySlug.get(existingSlug)!;

      // Norm-kolízia dvoch krajinských variantov (Aquaangels.sk vs Aqua-angels.cz):
      // víťaza určuje krajina (.sk > .cz > ostatné), nie poradie v zdroji.
      // Nováčik s lepšou krajinou preberá identitu (meno/slug/doménu),
      // kurátorské "top" záznamy sa nikdy nenahrádzajú.
      const newPriority = getShopPriority(domain || name);
      const oldPriority = getShopPriority(e.domain || e.name);
      if (e.source !== "top" && newPriority < oldPriority) {
        this.bySlug.delete(existingSlug);
        this.bySlug.set(slug, {
          name,
          slug,
          domain,
          category:
            e.category && e.category !== "Obchod"
              ? e.category
              : input.category || "Obchod",
          source: input.source,
          count: input.count ?? e.count,
          commission: input.commission || e.commission,
          logoUrl: input.logoUrl || e.logoUrl,
        });
        for (const [n, s] of this.slugByNorm) {
          if (s === existingSlug) this.slugByNorm.set(n, slug);
        }
        if (norm && !this.slugByNorm.has(norm)) this.slugByNorm.set(norm, slug);
        return;
      }

      // Doménu horšej krajiny nikdy nedopĺňať do záznamu lepšej krajiny
      // (.cz doména nesmie prepísať/doplniť .sk obchod).
      if (!e.domain && domain && getShopPriority(domain) <= getShopPriority(e.name)) {
        e.domain = domain;
      }
      if (e.count === undefined && input.count !== undefined) e.count = input.count;
      if (!e.commission && input.commission) e.commission = input.commission;
      if (!e.logoUrl && input.logoUrl) e.logoUrl = input.logoUrl;
      if ((!e.category || e.category === "Obchod") && input.category && input.category !== "Obchod") {
        e.category = input.category;
      }
      return;
    }

    this.bySlug.set(slug, {
      name,
      slug,
      domain,
      category: input.category || "Obchod",
      source: input.source,
      count: input.count,
      commission: input.commission,
      logoUrl: input.logoUrl,
    });
    if (norm && !this.slugByNorm.has(norm)) this.slugByNorm.set(norm, slug);
  }

  list(): KnownShop[] {
    return Array.from(this.bySlug.values());
  }
}

interface DognetShopLike {
  name: string;
  count?: number;
  logoUrl?: string;
}

/** Čisté zlúčenie všetkých zdrojov — exportované aj pre audit/testy. */
export function buildKnownShops(input: {
  dognet: DognetShopLike[];
  ehub: EhubShop[];
  cj: Pick<CjShop, "advertiserName" | "commission">[];
}): KnownShop[] {
  const c = new ShopCollector();

  // 1. Kurátorské obchody so stránkou — musia byť vždy prítomné
  for (const s of TOP_SHOPS) {
    c.add({ name: s.name, slug: s.slug, domain: s.domain, category: s.category, source: "top" });
  }

  // 2. Dognet (má počty kupónov)
  for (const s of input.dognet) {
    c.add({ name: s.name, source: "dognet", count: s.count, logoUrl: s.logoUrl });
  }

  // 3. eHub
  for (const s of input.ehub) {
    if (!s.name) continue;
    c.add({
      name: s.name,
      domain: s.web ? webToDomain(s.web) : "",
      category: s.category || "Iné",
      source: "ehub",
      commission: s.commission || undefined,
      logoUrl: s.logoUrl,
    });
  }

  // 4. CJ
  for (const s of input.cj) {
    c.add({ name: s.advertiserName, source: "cj", commission: s.commission || undefined });
  }

  // 5. Affial partnerské obchody (statické)
  for (const s of AFFIAL_SHOPS) {
    c.add({
      name: s.name,
      domain: s.domain,
      category: AFFIAL_CAT_LABELS[s.category] ?? "Iné",
      source: "affial",
      commission: s.commission,
    });
  }

  // 6. Obchody zo statických Affial kupónov (napr. Namaximum.sk, Remoska.sk)
  for (const s of AFFIAL_COUPONS) {
    c.add({ name: s.shop, domain: s.domain, category: "Partnerský obchod", source: "affial-coupon" });
  }

  // .sk → .cz → ostatné, v rámci priority abecedne
  return c.list().sort(compareShopsByPriority);
}

/**
 * Statická varianta bez sieťových volaní — pre generateStaticParams
 * a fallback, keď live zdroje zlyhajú. Používa public/data JSON snapshoty.
 */
export function getStaticKnownShops(): KnownShop[] {
  return buildKnownShops({
    dognet: getStaticShops(),
    ehub: getStaticEhubShops(),
    cj: [],
  });
}

/**
 * Všetky známe obchody zo všetkých zdrojov (live + statické), deduplikované,
 * s Redis cache. Jediný zdroj pravdy pre autocomplete, /obchody, sitemap
 * a shop stránky.
 */
export async function getAllKnownShops(): Promise<KnownShop[]> {
  try {
    const cached = await redis.get<KnownShop[]>(CACHE_KEY);
    if (cached && Array.isArray(cached) && cached.length > 0) return cached;
  } catch {}

  const [dognetRes, ehubRes, cjRes] = await Promise.allSettled([
    getDognetShops(),
    getEhubShops(),
    getCjShops(),
  ]);

  const dognet = dognetRes.status === "fulfilled" && dognetRes.value.length > 0
    ? dognetRes.value
    : getStaticShops();
  const ehub = ehubRes.status === "fulfilled" && ehubRes.value.length > 0
    ? ehubRes.value
    : getStaticEhubShops();
  const cj = cjRes.status === "fulfilled" ? cjRes.value : [];

  const result = buildKnownShops({ dognet, ehub, cj });

  // Cache len keď máme viac než len statický kurátorský základ
  if (result.length > TOP_SHOPS.length) {
    try { await redis.set(CACHE_KEY, result, { ex: CACHE_TTL }); } catch {}
  }

  return result;
}
