import type { Article } from "@/lib/articles";
import { AFFIAL_SHOPS, type AffialShop } from "@/lib/affial-shops";
import { normalizeShopSlug } from "@/lib/slug";

/**
 * Kurátorské články o obchodoch, ktoré REÁLNE monetizujeme (Affial partneri —
 * majú affiliate tracking URL + províziu). CTA vedie na skutočný affiliate odkaz,
 * takže klik zarába. Žiadne značky bez programu (Nike/Zalando/Lidl...).
 *
 * Renderujú sa vždy (nezávisle od Redisu/cronu). Redis článok s rovnakým slugom
 * má prednosť — cron/admin ich môžu obohatiť o produktový grid.
 *
 * Obsah je vedome bez konkrétnych cien a percent (nemáme ich overené) —
 * v súlade s pravidlom „žiadne fiktívne ceny/zľavy".
 */

type Cat = "zdravie" | "krasa" | "sport" | "byvanie" | "moda" | "ine";

const CAT_ACCENT: Record<Cat, string> = {
  zdravie: "#16A34A", krasa: "#E6007E", sport: "#0082C3",
  byvanie: "#B45309", moda: "#7C3AED", ine: "#0F172A",
};

const CAT_NOUN: Record<Cat, string> = {
  zdravie: "vitamíny a doplnky výživy",
  krasa: "kozmetika a starostlivosť",
  sport: "športové vybavenie",
  byvanie: "vybavenie do domácnosti",
  moda: "oblečenie a doplnky",
  ine: "akcie a zľavy",
};

const CAT_PEREX: Record<Cat, string> = {
  zdravie: "doplnky výživy, vitamíny a produkty pre zdravie",
  krasa: "kozmetika a starostlivosť o pleť, vlasy a telo",
  sport: "športové vybavenie, oblečenie a doplnky",
  byvanie: "vybavenie a dekorácie do domácnosti",
  moda: "oblečenie, obuv a módne doplnky",
  ine: "široký sortiment produktov",
};

const CAT_CONTENT: Record<Cat, { p1: (n: string) => string; p2: string; tips: string[] }> = {
  zdravie: {
    p1: (n) => `${n} sa zameriava na zdravie a vitalitu — nájdeš tu doplnky výživy, vitamíny a prírodné produkty pre imunitu a každodennú pohodu.`,
    p2: "Oplatí sa sledovať akciové balíčky a množstevné zľavy, pri ktorých vyjde cena za balenie výhodnejšie ako pri kúpe jednotlivo.",
    tips: ["Doplnky výživy a vitamíny", "Akciové balíčky a sety", "Sezónne produkty pre imunitu"],
  },
  krasa: {
    p1: (n) => `${n} ponúka kozmetiku a produkty pre starostlivosť o pleť, vlasy a telo.`,
    p2: "V akciovej ponuke nájdeš zlacnené kúsky aj obľúbené produkty za výhodnejšie ceny.",
    tips: ["Pleťová a telová kozmetika", "Akciové sety a darčeky", "Novinky a obľúbené produkty"],
  },
  sport: {
    p1: (n) => `${n} je zameraný na šport a aktívny životný štýl — nájdeš tu vybavenie, oblečenie aj doplnky.`,
    p2: "Sezónne výpredaje bývajú výhodné najmä pri obuvi a oblečení z predošlých kolekcií.",
    tips: ["Športové vybavenie a doplnky", "Oblečenie a obuv", "Sezónne zľavy"],
  },
  byvanie: {
    p1: (n) => `${n} sa venuje domácnosti a bývaniu — nájdeš tu vybavenie, dekorácie a produkty pre útulný domov.`,
    p2: "Akcie a zľavy sa oplatí sledovať najmä pri väčších kúskoch do interiéru.",
    tips: ["Vybavenie a dekorácie do domu", "Akciové zľavy", "Novinky do interiéru"],
  },
  moda: {
    p1: (n) => `${n} ponúka oblečenie, obuv a módne doplnky.`,
    p2: "Vo výpredaji nájdeš zlacnené kúsky z aktuálnych aj predošlých kolekcií.",
    tips: ["Oblečenie a obuv", "Módne doplnky", "Výpredajové zľavy"],
  },
  ine: {
    p1: (n) => `${n} ponúka široký sortiment produktov za dobré ceny.`,
    p2: "Pozri aktuálnu ponuku a akcie a nakúp výhodne.",
    tips: ["Aktuálne akcie a zľavy", "Novinky v ponuke"],
  },
};

// Kurátorský výber domén (Affial partneri s dobrou províziou, naprieč kategóriami).
// Poradie = poradie na webe (prvé = najnovšie).
const CURATED_DOMAINS: string[] = [
  "collalloc.com",     // zdravie 19%
  "blendea.sk",        // zdravie
  "powerlogy.cz",      // zdravie
  "vimax.sk",          // zdravie 13%
  "superstrava.sk",    // zdravie 11.5%
  "nechtovyraj.sk",    // krasa 6%
  "kosmetikomat.sk",   // krasa 11.3%
  "spaceylon.sk",      // krasa 7%
  "enemiq.sk",         // moda 10.5%
  "arno-obuv.sk",      // moda 11.2%
  "shox.sk",           // sport 5%
  "tpmove.sk",         // sport 14%
  "li-go.cz",          // byvanie 20%
  "artofhome.cz",      // byvanie 10.5%
  "e-matrac.sk",       // byvanie 4.9%
];

function catOf(s: AffialShop): Cat {
  const c = (s.category || "ine").toLowerCase();
  return (["zdravie", "krasa", "sport", "byvanie", "moda"].includes(c) ? c : "ine") as Cat;
}

const TAIL = `<p>Ceny, dostupnosť aj podmienky akcie sa môžu meniť — vždy si ich over priamo v obchode pred nákupom. Odkazy vedú do obchodu cez náš partnerský program.</p>`;

function buildArticle(s: AffialShop, dateIso: string): Article {
  const cat = catOf(s);
  const content = CAT_CONTENT[cat];
  const html = `<p>${content.p1(s.name)}</p><p>${content.p2}</p><h2>Čo sa oplatí sledovať</h2><ul>${content.tips.map((t) => `<li>${t}</li>`).join("")}</ul>${TAIL}`;
  return {
    slug: `${normalizeShopSlug(s.name)}-akcie`,
    type: "sale",
    title: `${s.name} – ${CAT_NOUN[cat]}`,
    perex: `${s.name}: ${CAT_PEREX[cat]}. Pozri aktuálnu ponuku, akcie a nakúp výhodne.`,
    content: html,
    shopName: s.name,
    domain: s.domain,
    shopSlug: normalizeShopSlug(s.name),
    discountPct: null,           // žiadne fiktívne %
    products: [],
    affiliateUrl: s.affiliateUrl, // REÁLNY affiliate tracking link
    date: dateIso,
    updatedAt: dateIso,
    published: true,
    source: "manual",
  };
}

const byDomain = new Map(AFFIAL_SHOPS.map((s) => [s.domain.toLowerCase(), s]));

export const STATIC_SALE_ARTICLES: Article[] = CURATED_DOMAINS
  .map((d, i) => {
    const shop = byDomain.get(d);
    if (!shop) return null;
    // dátumy zostupne od 2026-07-21
    const day = 21 - i;
    const iso = `2026-07-${String(Math.max(day, 1)).padStart(2, "0")}T09:00:00Z`;
    return buildArticle(shop, iso);
  })
  .filter((a): a is Article => a !== null);

/** Mapa slug → accent farba bannera (pre ArticleCard, keď článok nemá obrázok). */
export const ARTICLE_ACCENTS: Record<string, string> = Object.fromEntries(
  STATIC_SALE_ARTICLES.map((a) => {
    const shop = byDomain.get((a.domain || "").toLowerCase());
    return [a.slug, shop ? CAT_ACCENT[catOf(shop)] : "#0F172A"];
  })
);
