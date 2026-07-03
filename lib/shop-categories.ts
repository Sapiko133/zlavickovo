import { type CategoryId, categoryIdFromLabel } from "@/lib/taxonomy";
import { normalizeShopSlug } from "@/lib/slug";

/**
 * Explicitné priradenie obchod → kategória. Jediný zdroj pravdy pre
 * kategorizáciu obchodov — nahrádza keyword matching (inferCategory).
 *
 * Kľúč = kanonický slug obchodu (normalizeShopSlug), t. j. bez TLD:
 * "Alza.sk" aj "Alza" → "alza". Hodnota = CategoryId z lib/taxonomy.ts.
 *
 * Obchod, ktorý tu nie je, sa skúsi zaradiť cez sieťovú kategóriu
 * (eHub/Affial label) v resolveCategory(); inak zostáva nezaradený —
 * nezaradené obchody odhaľuje scripts/audit-categories.ts.
 */
export const SHOP_CATEGORIES: Record<string, CategoryId> = {
  // Elektronika
  alza: "elektronika",
  mall: "elektronika",
  datart: "elektronika",
  nay: "elektronika",
  czc: "elektronika",
  okay: "elektronika",
  samsung: "elektronika",
  apple: "elektronika",
  lenovo: "elektronika",
  hp: "elektronika",
  dell: "elektronika",

  // Móda
  zalando: "moda",
  shein: "moda",
  asos: "moda",
  "about-you": "moda",
  answear: "moda",
  zara: "moda",
  hm: "moda",
  bershka: "moda",
  dedoles: "moda",
  zoot: "moda",
  enemiq: "moda",
  "arno-obuv": "moda",
  bonprix: "moda",
  sizeer: "moda",

  // Zdravie
  gymbeam: "zdravie",
  "dr-max": "zdravie",
  drmax: "zdravie",
  herbatica: "zdravie",
  superstrava: "zdravie",
  blendea: "zdravie",
  altevita: "zdravie",
  benulekaren: "zdravie",
  lieky24: "zdravie",
  protein: "zdravie",

  // Krása
  notino: "krasa",
  kosmetikomat: "krasa",
  spaceylon: "krasa",
  nechtovyraj: "krasa",

  // Šport
  sportisimo: "sport",
  decathlon: "sport",
  intersport: "sport",
  nike: "sport",
  adidas: "sport",
  shox: "sport",
  belda: "sport",
  tpmove: "sport",
  sportby: "sport",

  // Bývanie
  ikea: "byvanie",
  hornbach: "byvanie",
  obi: "byvanie",
  "e-matrac": "byvanie",
  artofhome: "byvanie",
  "li-go": "byvanie",
  "4home": "byvanie",
  dekoria: "byvanie",

  // Potraviny
  lidl: "potraviny",
  kaufland: "potraviny",
  tesco: "potraviny",
  billa: "potraviny",
  rohlik: "potraviny",

  // Deti
  dadaboom: "deti",
  "kojenecke-obleceni": "deti",
  "milinko-oblecenie": "deti",
  bubulakovo: "deti",

  // Cestovanie
  booking: "cestovanie",
  airbnb: "cestovanie",
  invia: "cestovanie",

  // Knihy
  martinus: "knihy",
  bux: "knihy",
  "panta-rhei": "knihy",

  // Iné
  temu: "ine",
  wish: "ine",
};

export interface ResolveCategoryInput {
  /** Zobrazované meno obchodu ("Alza.sk", "Dr. Max") */
  name?: string | null;
  /** Kanonický slug, ak ho volajúci už má */
  slug?: string | null;
  /** Doména obchodu ("alza.sk") */
  domain?: string | null;
  /** Label kategórie zo siete (eHub CZ label, Affial slug, SK label) */
  networkCategory?: string | null;
}

/**
 * Zaradí obchod do kanonickej kategórie. Poradie: explicitná mapa
 * (slug → meno → doména), potom mapovanie sieťového labelu.
 * Vracia null, keď obchod nevieme zaradiť — ŽIADNE hádanie z kľúčových slov.
 */
export function resolveCategory(input: ResolveCategoryInput): CategoryId | null {
  const keys = [
    input.slug || "",
    input.name ? normalizeShopSlug(input.name) : "",
    input.domain ? normalizeShopSlug(input.domain) : "",
  ];
  for (const key of keys) {
    if (key && SHOP_CATEGORIES[key]) return SHOP_CATEGORIES[key];
  }
  return categoryIdFromLabel(input.networkCategory);
}
