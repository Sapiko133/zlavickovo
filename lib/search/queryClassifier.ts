import { normalizeShopName, normalizeShopSlug } from "@/lib/slug";

/**
 * Klasifikácia vyhľadávacieho dopytu: obchod / kategória / produkt.
 *
 * Obchody NIE sú ručný zoznam — jediný zdroj pravdy je getAllKnownShops()
 * (lib/all-shops.ts), na klientovi dostupný cez GET /api/autocomplete
 * (default mode). Na /kupony/[slug] smerujeme len dopyty, ktoré presne
 * zodpovedajú existujúcemu obchodu.
 */

export interface KnownShopLite {
  name: string;
  slug: string;
}

const CATEGORY_MAP: Record<string, string> = {
  "mobily": "Mobily",
  "telefóny": "Mobily",
  "telefony": "Mobily",
  "smartfóny": "Mobily",
  "smartfony": "Mobily",
  "notebooky": "Notebooky",
  "laptopy": "Notebooky",
  "laptops": "Notebooky",
  "televízory": "Televízory",
  "televizory": "Televízory",
  "tv": "Televízory",
  "chladničky": "Chladničky",
  "chladnicky": "Chladničky",
  "práčky": "Práčky",
  "pracky": "Práčky",
  "elektronika": "Elektronika",
  "tenisky": "Tenisky",
  "oblečenie": "Oblečenie",
  "oblecenie": "Oblečenie",
  "šaty": "Oblečenie",
  "saty": "Oblečenie",
  "topánky": "Topánky",
  "topanky": "Topánky",
  "obuv": "Topánky",
  "móda": "Móda",
  "moda": "Móda",
  "parfumy": "Parfumy",
  "kozmetika": "Kozmetika",
  "krása": "Kozmetika",
  "krasa": "Kozmetika",
  "šport": "Šport",
  "sport": "Šport",
  "fitness": "Šport",
  "bicykle": "Šport",
  "nábytok": "Bývanie",
  "nabytok": "Bývanie",
  "bývanie": "Bývanie",
  "byvanie": "Bývanie",
  "potraviny": "Potraviny",
  "jedlo": "Potraviny",
  "knihy": "Knihy",
  "hračky": "Deti",
  "hracky": "Deti",
  "deti": "Deti",
};

export type QueryType = "shop" | "category" | "product";

/**
 * Nájde obchod v zozname známych obchodov — len presná zhoda
 * (normalizovaný slug alebo normalizovaný názov). "alza"/"Alza.sk" → alza,
 * ale "samsung" nevráti nič, ak taký obchod v zozname nie je.
 */
export function findShopInList(
  query: string,
  shops: KnownShopLite[]
): { slug: string } | null {
  const sq = normalizeShopSlug(query);
  const nq = normalizeShopName(query);
  if (!sq && !nq) return null;
  for (const shop of shops) {
    if (sq && shop.slug === sq) return { slug: shop.slug };
    if (nq && normalizeShopName(shop.name) === nq) return { slug: shop.slug };
  }
  return null;
}

// Zoznam obchodov sa načíta raz a zdieľa medzi volaniami (module scope)
let _shopsCache: KnownShopLite[] | null = null;
let _shopsPromise: Promise<KnownShopLite[]> | null = null;

async function loadKnownShops(): Promise<KnownShopLite[]> {
  if (_shopsCache) return _shopsCache;
  if (!_shopsPromise) {
    _shopsPromise = fetch("/api/autocomplete")
      .then(r => r.json())
      .then((d: KnownShopLite[]) => {
        _shopsCache = Array.isArray(d)
          ? d.map(s => ({ name: s.name, slug: s.slug }))
          : [];
        return _shopsCache;
      })
      .catch(() => {
        _shopsPromise = null;
        return [];
      });
  }
  return _shopsPromise;
}

/** Async varianta pre klienta — sama si načíta zoznam obchodov. */
export async function findShop(query: string): Promise<{ slug: string } | null> {
  const shops = await loadKnownShops();
  return findShopInList(query, shops);
}

export function getCategoryLabel(query: string): string | null {
  return CATEGORY_MAP[query.toLowerCase().trim()] ?? null;
}
