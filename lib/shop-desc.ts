import { redis } from "@/lib/redis";
import { getDb } from "@/lib/db";

export interface ShopDescription {
  short: string;   // ~100–150 slov — hero + meta
  long: string;    // ~300–600 slov — sekcia „O obchode"
  source: "db" | "curated" | "cache" | "ai" | "fallback";
}

const GENERIC: Record<string, string> = {
  alza: "Alza.sk je najväčší slovenský e-shop s elektronikou, spotrebičmi, mobilmi a tisíckami ďalších produktov. Ponúka rýchle doručenie, vernostný program Alza Body a pravidelné akcie s veľkými zľavami. Ide-álne miesto pre nákup elektroniky za konkurenčné ceny.",
  shein: "Shein je globálna módna platforma s obrovským výberom oblečenia, obuvi a doplnkov za ultra-nízke ceny. Ponúka nové kolekcie každý deň a exkluzívne zľavy pre nových zákazníkov aj verných nakupujúcich.",
  zalando: "Zalando je najväčší európsky módny e-shop s tisíckami značiek od Adidas, Nike až po H&M a Zara. Bezplatné vrátenie tovaru, rýchle doručenie a rozsiahla SALE sekcia robia z Zalando ideálne miesto pre módu.",
  mall: "Mall.sk je komplexný e-shop s elektronikou, domácimi spotrebičmi, nábytkom a športovým vybavením. Ponúka prémiový vernostný program a pravidelnú sekciu s výpredajmi.",
  notino: "Notino je najväčšia online parfuméria v Európe s tisíckami parfumov, kozmetiky a prípravkov na starostlivosť o pleť a vlasy. Nájdeš tu prémiové značky za výhodné ceny.",
  sportisimo: "Sportisimo je vedúci predajca športového vybavenia na Slovensku. Ponúka oblečenie, obuv a vybavenie pre všetky športy od Nike, Adidas, Puma a ďalších svetových značiek.",
  ikea: "IKEA je synonymom pre škandinávsky dizajn a dostupný nábytok. Ponúka kompletné riešenia pre každú miestnosť, od obývačky po kúpeľňu, za ceny dostupné pre každého.",
  dedoles: "Dedoles je slovenská módna značka known pre originálne potlačené ponožky, pyžamá a oblečenie. Každý produkt je originálny kúsok, ideálny ako darček alebo na každodenné nosenie.",
  martinus: "Martinus je najobľúbenejší slovenský kníhkupec s obrovským výberom kníh, e-kníh a audiokníh. Ponúka slovenské aj české tituly, novinky aj klasiku za výhodné ceny.",
  "about-you": "About You je personalizovaná módna platforma s výberom prispôsobeným tvojmu vkusu. Predáva oblečenie, obuv a doplnky od stoviek európskych a svetových značiek.",
  "dr-max": "Dr. Max je najväčšia lekárenská sieť na Slovensku. Online lekáreň ponúka lieky bez predpisu, vitamíny, doplnky stravy a kozmetiku s rýchlym doručením.",
  czc: "CZC.cz je jeden z najväčších českých e-shopov s počítačmi, komponentmi, notebookmi, mobilmi a hernou technikou. Ponúka odborné poradenstvo, rýchle doručenie aj na Slovensko a pravidelné akcie na PC zostavy, grafické karty a príslušenstvo. Ceny sú v českých korunách, obchod je súčasťou skupiny Alza.",
  gymbeam: "GymBeam je slovenská fitness e-commerce úspešnica s vlastnou výrobou proteínov, vitamínov a ďalších doplnkov stravy. Výborný pomer ceny a kvality pre každého, kto dbá o zdravý životný štýl.",
};

function genericDesc(shopName: string): string {
  const key = shopName.toLowerCase().replace(/\s+/g, "-");
  if (GENERIC[key]) return GENERIC[key];
  return `${shopName} je populárny online obchod ponúkajúci širokú škálu produktov pre slovenských zákazníkov. Pravidelne vydáva zľavové kódy a akcie, vďaka ktorým môžete ušetriť na svojich nákupoch. Nájdite aktuálne kupóny práve tu na Zlavickovo.sk.`;
}

/**
 * Načíta uložený popis z tabuľky shop_descriptions (generátor ju napĺňa offline).
 * null = záznam neexistuje; undefined = DB chyba (necachuje sa).
 */
async function fromDbUncached(slug: string): Promise<ShopDescription | null | undefined> {
  try {
    const sql = getDb();
    const rows = (await sql`
      SELECT short_description, long_description FROM shop_descriptions WHERE slug = ${slug} LIMIT 1
    `) as { short_description: string; long_description: string }[];
    const row = rows[0];
    if (row && (row.short_description || row.long_description)) {
      const short = row.short_description || row.long_description;
      const long = row.long_description || row.short_description;
      return { short, long, source: "db" };
    }
  } catch {
    // Tabuľka nemusí ešte existovať / DB nedostupná — pokračuj na ďalší zdroj.
    return undefined;
  }
  return null;
}

// Stránka obchodu je dynamická → bez cache by KAŽDÝ request robil Neon dotaz
// (studený štart compute + cesta do eu-central). Popisy generuje offline skript,
// menia sa zriedka: Redis cache 7 dní vrátane negatívneho výsledku + procesové memo.
const DB_DESC_TTL = 7 * 86400;
const dbMemo = new Map<string, { at: number; value: ShopDescription | null }>();

async function fromDb(slug: string): Promise<ShopDescription | null> {
  const m = dbMemo.get(slug);
  if (m && Date.now() - m.at < 3600_000) return m.value;
  const key = `shop_desc:db:v1:${slug}`;
  try {
    const cached = await redis.get<{ short?: string; long?: string; none?: true }>(key);
    if (cached) {
      const value = cached.none ? null : { short: cached.short ?? "", long: cached.long ?? "", source: "db" as const };
      dbMemo.set(slug, { at: Date.now(), value });
      return value;
    }
  } catch {}
  const value = await fromDbUncached(slug);
  if (value === undefined) return null; // DB chyba — skús nabudúce, necachuj
  dbMemo.set(slug, { at: Date.now(), value });
  try {
    await redis.set(key, value ? { short: value.short, long: value.long } : { none: true }, { ex: DB_DESC_TTL });
  } catch {}
  return value;
}

/**
 * Štruktúrovaný popis obchodu pre stránku /kupony/[slug].
 * Poradie zdrojov: DB (generátor) → kurátorský text → Redis cache (staršie texty) → deterministický fallback.
 * Platené AI API sa pri renderi nevolá (náklady + nekontrolované tvrdenia o obchode).
 */
export async function getShopDescription(shopName: string, slug: string): Promise<ShopDescription> {
  // 1. DB — trvalý zdroj generovaný scriptom (short + long)
  const db = await fromDb(slug);
  if (db) return db;

  // 2. Kurátorský text má prednosť pred cache aj AI — deterministický popis
  if (GENERIC[slug]) {
    return { short: GENERIC[slug], long: GENERIC[slug], source: "curated" };
  }

  const cacheKey = `shop_desc:${slug}`;

  // 3. Redis cache (legacy jednotlivý text)
  try {
    const cached = await redis.get<string>(cacheKey);
    if (cached) return { short: cached, long: cached, source: "cache" };
  } catch {}

  // 4. Deterministický fallback (bez AI)
  const desc = genericDesc(shopName);
  try { await redis.set(cacheKey, desc, { ex: 86400 * 7 }); } catch {}
  return { short: desc, long: desc, source: "fallback" };
}
