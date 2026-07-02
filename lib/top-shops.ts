/**
 * Kurátorský zoznam obchodov, ktoré majú na webe vlastnú stránku /kupony/[slug].
 * Zdieľaný medzi serverovým autocomplete (app/api/autocomplete) a klientskym
 * hookom (hooks/useAutocomplete) — obchod so stránkou musí byť vždy nájditeľný.
 */
export interface TopShop {
  name: string;
  slug: string;
  category: string;
  domain: string;
}

export const TOP_SHOPS: TopShop[] = [
  { name: "Alza",        slug: "alza",        category: "Elektronika", domain: "alza.sk" },
  { name: "Mall",        slug: "mall",        category: "Elektronika", domain: "mall.sk" },
  { name: "Datart",      slug: "datart",      category: "Elektronika", domain: "datart.sk" },
  { name: "NAY",         slug: "nay",         category: "Elektronika", domain: "nay.sk" },
  { name: "Zalando",     slug: "zalando",     category: "Móda",        domain: "zalando.sk" },
  { name: "Shein",       slug: "shein",       category: "Móda",        domain: "shein.com" },
  { name: "About You",   slug: "about-you",   category: "Móda",        domain: "aboutyou.sk" },
  { name: "Answear",     slug: "answear",     category: "Móda",        domain: "answear.sk" },
  { name: "Zara",        slug: "zara",        category: "Móda",        domain: "zara.com" },
  { name: "H&M",         slug: "hm",          category: "Móda",        domain: "hm.com" },
  { name: "Dedoles",     slug: "dedoles",     category: "Móda",        domain: "dedoles.sk" },
  { name: "ZOOT",        slug: "zoot",        category: "Móda",        domain: "zoot.sk" },
  { name: "ASOS",        slug: "asos",        category: "Móda",        domain: "asos.com" },
  { name: "Notino",      slug: "notino",      category: "Krása",       domain: "notino.sk" },
  { name: "GymBeam",     slug: "gymbeam",     category: "Zdravie",     domain: "gymbeam.sk" },
  { name: "Dr. Max",     slug: "dr-max",      category: "Zdravie",     domain: "drmax.sk" },
  { name: "Sportisimo",  slug: "sportisimo",  category: "Šport",       domain: "sportisimo.sk" },
  { name: "Decathlon",   slug: "decathlon",   category: "Šport",       domain: "decathlon.sk" },
  { name: "Nike",        slug: "nike",        category: "Šport",       domain: "nike.com" },
  { name: "Adidas",      slug: "adidas",      category: "Šport",       domain: "adidas.com" },
  { name: "IKEA",        slug: "ikea",        category: "Bývanie",     domain: "ikea.com" },
  { name: "Martinus",    slug: "martinus",    category: "Knihy",       domain: "martinus.sk" },
  { name: "Lidl",        slug: "lidl",        category: "Potraviny",   domain: "lidl.sk" },
  { name: "Kaufland",    slug: "kaufland",    category: "Potraviny",   domain: "kaufland.sk" },
  { name: "Temu",        slug: "temu",        category: "Iné",         domain: "temu.com" },
];
