/**
 * Reprezentatívne URL mimo sitemap, ktoré SEO audit vždy otestuje:
 * parametre, stránkovanie, veľké písmená, interné vyhľadávanie, neexistujúce
 * entity a legacy presmerovania. Očakávané správanie je v komentároch.
 */
export const SEO_AUDIT_EXTRA_PATHS: string[] = [
  "/kupony?page=2",                 // 200, self-canonical, index
  "/kupony?page=9999",              // 404 (stránka mimo rozsahu)
  "/kupony?sort=discount",          // 200, noindex,follow
  "/kupony?q=alza",                 // 200, noindex,follow
  "/kupony/alza?utm_source=test",   // 200, canonical bez parametrov
  "/kupony/Alza",                   // 308 → /kupony/alza
  "/kupony/alza-cz",                // canonical → /kupony/alza
  "/kupony/neexistujuci-obchod-xyz",// 404
  "/kategoria/Elektronika",         // 308 → /kategoria/elektronika
  "/kategoria/ine",                 // 404 (skrytá kategória)
  "/akcie/neexistujuca-akcia-xyz",  // 404
  "/hladat?q=alza",                 // noindex,follow
  "/blog",                          // 308 → /akcie
  "/produkt/abc",                   // 308 → /akcie
];
