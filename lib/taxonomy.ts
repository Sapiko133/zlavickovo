/**
 * Kanonická taxonómia kategórií — jediný zdroj pravdy pre zoznam kategórií,
 * ich vizuál (emoji, farby) a kurátorské obchody zobrazované na stránke
 * kategórie. Priradenie obchod → kategória rieši lib/shop-categories.ts
 * (resolveCategory), NIE keyword matching.
 */

export type CategoryId =
  | "elektronika"
  | "moda"
  | "zdravie"
  | "krasa"
  | "sport"
  | "byvanie"
  | "potraviny"
  | "deti"
  | "cestovanie"
  | "knihy"
  | "ine";

export interface FeaturedShop {
  name: string;
  slug: string;
  /** Override cieľa — napr. potraviny linkujú na /letaky/[slug] */
  href?: string;
}

export interface TaxonomyCategory {
  id: CategoryId;
  label: string;
  emoji: string;
  desc: string;
  color: string;
  bg: string;
  /** Kurátorské obchody zobrazované v gride na /kategoria/[slug] */
  featuredShops: FeaturedShop[];
  /** Zberná kategória bez vlastnej stránky (napr. "ine") */
  hidden?: true;
}

export const TAXONOMY: Record<CategoryId, TaxonomyCategory> = {
  elektronika: {
    id: "elektronika", label: "Elektronika", emoji: "💻",
    desc: "Kupóny na laptopy, TV, foto, audio a domáce spotrebiče.",
    color: "#0065BD", bg: "#dbeafe",
    featuredShops: [
      { name: "Alza", slug: "alza" },
      { name: "Datart", slug: "datart" },
      { name: "Mall", slug: "mall" },
      { name: "CZC.cz", slug: "czc" },
      { name: "NAY", slug: "nay" },
    ],
  },
  moda: {
    id: "moda", label: "Móda", emoji: "👗",
    desc: "Zľavy na oblečenie, obuv a módne doplnky.",
    color: "#E8001D", bg: "#fce7f3",
    featuredShops: [
      { name: "Zalando", slug: "zalando" },
      { name: "Shein", slug: "shein" },
      { name: "ASOS", slug: "asos" },
      { name: "About You", slug: "about-you" },
      { name: "Answear", slug: "answear" },
      { name: "Enemiq", slug: "enemiq" },
      { name: "Arno Obuv", slug: "arno-obuv" },
    ],
  },
  zdravie: {
    id: "zdravie", label: "Zdravie", emoji: "💊",
    desc: "Vitamíny, doplnky výživy, biopotraviny a zdravá výživa.",
    color: "#00A551", bg: "#dcfce7",
    featuredShops: [
      { name: "GymBeam", slug: "gymbeam" },
      { name: "Dr. Max", slug: "dr-max" },
      { name: "Notino", slug: "notino" },
      { name: "Herbatica", slug: "herbatica" },
      { name: "Superstrava", slug: "superstrava" },
      { name: "Blendea", slug: "blendea" },
      { name: "Altevita", slug: "altevita" },
    ],
  },
  krasa: {
    id: "krasa", label: "Krása", emoji: "💄",
    desc: "Kozmetika, parfumy, starostlivosť o pleť a vlasy.",
    color: "#db2777", bg: "#fdf2f8",
    featuredShops: [
      { name: "Notino", slug: "notino" },
      { name: "Kosmetikomat", slug: "kosmetikomat" },
      { name: "Spaceylon", slug: "spaceylon" },
      { name: "Nechtovyraj", slug: "nechtovyraj" },
    ],
  },
  sport: {
    id: "sport", label: "Šport", emoji: "⚽",
    desc: "Kupóny na športové vybavenie, oblečenie a obuv.",
    color: "#FF6900", bg: "#fed7aa",
    featuredShops: [
      { name: "Sportisimo", slug: "sportisimo" },
      { name: "Decathlon", slug: "decathlon" },
      { name: "Shox", slug: "shox" },
      { name: "Belda Sport", slug: "belda" },
    ],
  },
  byvanie: {
    id: "byvanie", label: "Bývanie", emoji: "🏠",
    desc: "Nábytok, osvetlenie, dekorácie a vybavenie domácnosti.",
    color: "#7C3AED", bg: "#ede9fe",
    featuredShops: [
      { name: "IKEA", slug: "ikea" },
      { name: "E-matrac", slug: "e-matrac" },
      { name: "Artofhome", slug: "artofhome-cz" },
      { name: "Li-Go", slug: "li-go-cz" },
    ],
  },
  potraviny: {
    id: "potraviny", label: "Potraviny", emoji: "🛒",
    desc: "Aktuálne akcie a letáky z potravinových reťazcov.",
    color: "#16a34a", bg: "#dcfce7",
    featuredShops: [
      { name: "Lidl", slug: "lidl", href: "/letaky/lidl" },
      { name: "Kaufland", slug: "kaufland", href: "/letaky/kaufland" },
      { name: "Tesco", slug: "tesco", href: "/letaky/tesco" },
      { name: "Billa", slug: "billa", href: "/letaky/billa" },
    ],
  },
  deti: {
    id: "deti", label: "Deti", emoji: "👶",
    desc: "Hračky, detské oblečenie a potreby pre bábätká a deti.",
    color: "#f59e0b", bg: "#fef3c7",
    featuredShops: [
      { name: "Dadaboom", slug: "dadaboom" },
      { name: "Kojenecké oblečenie", slug: "kojenecke-obleceni" },
    ],
  },
  cestovanie: {
    id: "cestovanie", label: "Cestovanie", emoji: "✈️",
    desc: "Zľavy na hotely, letenky a dovolenkové balíčky.",
    color: "#0ea5e9", bg: "#e0f2fe",
    // Žiadny obchod nemá kupónový zdroj ani shop stránku (Booking/Airbnb/Invia
    // odstránené — /kupony/[slug] vracalo 404). Sekcia obchodov sa nevyrenderuje.
    featuredShops: [],
  },
  knihy: {
    id: "knihy", label: "Knihy", emoji: "📚",
    desc: "Kupóny na knihy, audioknihy a e-booky.",
    color: "#D32F2F", bg: "#fee2e2",
    featuredShops: [
      { name: "Martinus", slug: "martinus" },
      { name: "Bux.sk", slug: "bux" },
      { name: "Panta Rhei", slug: "pantarhei" },
    ],
  },
  ine: {
    id: "ine", label: "Iné", emoji: "🎁",
    desc: "Obchody, ktoré nepatria do žiadnej z hlavných kategórií.",
    color: "#6b7280", bg: "#f3f4f6",
    featuredShops: [],
    hidden: true,
  },
};

/** Viditeľné kategórie (majú vlastnú stránku /kategoria/[id]) v poradí zobrazenia. */
export const TAXONOMY_LIST: TaxonomyCategory[] = Object.values(TAXONOMY).filter(c => !c.hidden);

export function isCategoryId(x: string): x is CategoryId {
  return x in TAXONOMY;
}

/** Lowercase + bez diakritiky — kľúč pre porovnávanie labelov. */
function foldLabel(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

/**
 * Mapovanie labelov na kanonické id: vlastné SK labely, kategórie
 * z eHub API (české) a Affial slugy (tie sú priamo CategoryId).
 * Kľúče sú foldLabel() tvary.
 */
const LABEL_TO_ID: Record<string, CategoryId> = {
  // vlastné id + SK labely
  ...Object.fromEntries(
    Object.values(TAXONOMY).flatMap(c => [
      [c.id, c.id],
      [foldLabel(c.label), c.id],
    ])
  ) as Record<string, CategoryId>,
  // eHub kategórie (CZ labely z campaigns API)
  "elektro a prislusenstvi": "elektronika",
  "moda a doplnky": "moda",
  "krasa a zdravi": "krasa",
  "potraviny a doplnky stravy": "potraviny",
  "dum a zahrada": "byvanie",
  "deti a hry": "deti",
  "cestovani": "cestovanie",
  "knihy a papirnictvi": "knihy",
  "automoto a kemping": "ine",
  "darky a alkohol": "ine",
  "zvirata": "ine",
  "ostatni": "ine",
};

/**
 * Prevedie sieťový/legacy label kategórie na kanonické id.
 * Vracia null pre neznáme labely (napr. "Obchod", "Partnerský obchod").
 */
export function categoryIdFromLabel(label: string | undefined | null): CategoryId | null {
  if (!label) return null;
  return LABEL_TO_ID[foldLabel(label)] ?? null;
}
