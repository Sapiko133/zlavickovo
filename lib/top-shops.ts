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
  { name: "Belda Sport", slug: "belda",       category: "Šport",       domain: "belda.sk" },
  { name: "Dadaboom",    slug: "dadaboom",    category: "Deti",        domain: "dadaboom.sk" },
  { name: "Kojenecké oblečenie", slug: "kojenecke-obleceni", category: "Deti", domain: "kojenecke-obleceni.eu" },
  { name: "Nike",        slug: "nike",        category: "Šport",       domain: "nike.com" },
  { name: "Adidas",      slug: "adidas",      category: "Šport",       domain: "adidas.com" },
  { name: "IKEA",        slug: "ikea",        category: "Bývanie",     domain: "ikea.com" },
  { name: "Martinus",    slug: "martinus",    category: "Knihy",       domain: "martinus.sk" },
  { name: "Lidl",        slug: "lidl",        category: "Potraviny",   domain: "lidl.sk" },
  { name: "Kaufland",    slug: "kaufland",    category: "Potraviny",   domain: "kaufland.sk" },
  { name: "Temu",        slug: "temu",        category: "Iné",         domain: "temu.com" },
  // ── Schválené SK programy s aktívnymi kódmi (audit 29.8.2026, overené proti
  //    live cache cez createShopMatcher — všetky sa riešia na /kupony/[slug]) ──
  { name: "Sizeer",         slug: "sizeer",         category: "Móda",        domain: "sizeer.sk" },
  { name: "Footshop",       slug: "footshop",       category: "Móda",        domain: "footshop.sk" },
  { name: "Bonprix",        slug: "bonprix",        category: "Móda",        domain: "bonprix.sk" },
  { name: "Eyerim",         slug: "eyerim",         category: "Móda",        domain: "eyerim.sk" },
  { name: "Larabags",       slug: "larabags",       category: "Móda",        domain: "larabags.sk" },
  { name: "Dyson",          slug: "dyson",          category: "Elektronika", domain: "dyson.sk" },
  { name: "Allegro",        slug: "allegro",        category: "Iné",         domain: "allegro.sk" },
  { name: "Tchibo",         slug: "tchibo",         category: "Iné",         domain: "tchibo.sk" },
  { name: "Coffeein",       slug: "coffeein",       category: "Iné",         domain: "coffeein.sk" },
  { name: "Faxcopy",        slug: "faxcopy",        category: "Iné",         domain: "faxcopy.sk" },
  { name: "Autovybava",     slug: "autovybava",     category: "Iné",         domain: "autovybava.sk" },
  { name: "4Home",          slug: "4home",          category: "Bývanie",     domain: "4home.sk" },
  { name: "Houseland",      slug: "houseland",      category: "Bývanie",     domain: "houseland.sk" },
  { name: "Dekoria",        slug: "dekoria",        category: "Bývanie",     domain: "dekoria.sk" },
  { name: "Inpostele",      slug: "inpostele",      category: "Bývanie",     domain: "inpostele.sk" },
  { name: "HomePoint",      slug: "homepoint",      category: "Bývanie",     domain: "homepoint.sk" },
  { name: "Benulekaren",    slug: "benulekaren",    category: "Zdravie",     domain: "benulekaren.sk" },
  { name: "Lieky24",        slug: "lieky24",        category: "Zdravie",     domain: "lieky24.sk" },
  { name: "Herbatica",      slug: "herbatica",      category: "Zdravie",     domain: "herbatica.sk" },
  { name: "eJoy",           slug: "ejoy",           category: "Zdravie",     domain: "ejoy.sk" },
  { name: "Incacollagen",   slug: "incacollagen",   category: "Zdravie",     domain: "incacollagen.sk" },
  { name: "Vitanella",      slug: "vitanella",      category: "Zdravie",     domain: "vitanella.sk" },
  { name: "Nakupujzdravo",  slug: "nakupujzdravo",  category: "Zdravie",     domain: "nakupujzdravo.sk" },
  { name: "IronAesthetics", slug: "ironaesthetics", category: "Šport",       domain: "ironaesthetics.sk" },
  { name: "Sportby",        slug: "sportby",        category: "Šport",       domain: "sportby.sk" },
  { name: "Zoohit",         slug: "zoohit",         category: "Iné",         domain: "zoohit.sk" },
  { name: "PetExpert",      slug: "petexpert",      category: "Iné",         domain: "petexpert.sk" },
];
