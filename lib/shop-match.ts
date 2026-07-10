import { normalizeShopName, normalizeShopSlug } from "@/lib/slug";

/** Základ domény bez www a TLD: "www.alza.sk" → "alza", "drmax.sk" → "drmax" */
export function domainBase(domain: string): string {
  return (domain || "")
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[/?#].*$/, "")
    .replace(/\.[a-z.]+$/, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Doménovo vyzerajúci token: "alza.sk", "www.alza.sk", "aqua-angels.cz" */
const DOMAIN_TOKEN_RE = /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i;

/**
 * Časti kandidátskeho názvu na presné porovnanie. Feedy nesú viac značiek/domén
 * v jednom názve ("Alza.cz + Alza.sk", "Vivantis.sk (parfémy)", "4home.sk -
 * všetko pre domácnosť") — porovnávajú sa jednotlivé časti, každá celá.
 */
function candidateVariants(candidateName: string): string[] {
  const variants = [candidateName];
  for (const part of candidateName.split(/[+,/&|()]+/)) {
    const trimmed = part.trim();
    if (trimmed && trimmed !== candidateName) variants.push(trimmed);
  }
  for (const token of candidateName.split(/\s+/)) {
    if (token !== candidateName && DOMAIN_TOKEN_RE.test(token)) variants.push(token);
  }
  return variants;
}

/**
 * Vytvorí matcher pre obchod zo slug-u / názvu stránky obchodu.
 * Porovnáva normalizovaný názov, slug aj doménu, takže
 * "Alza.sk", "Alza", "alza.sk" aj "alza" patria pod /kupony/alza.
 *
 * Match je PRESNÝ podľa normalizovaného názvu/slug-u/domény — nikdy substring.
 * Voľný includes tu kedysi posielal Mall na affiliate link BabyMall.cz
 * ("babymallcz" obsahuje "mall") a Tesco by chytalo Tescomu. Viacznačkové
 * názvy feedov rieši candidateVariants, nie substring.
 */
export function createShopMatcher(shopName: string) {
  const slug = normalizeShopSlug(shopName);
  const slugCompact = slug.replace(/-/g, "");
  const norm = normalizeShopName(shopName);

  function variantMatches(variant: string): boolean {
    const candNorm = normalizeShopName(variant);
    if (candNorm && (candNorm === norm || candNorm === slugCompact)) return true;
    if (slug && normalizeShopSlug(variant) === slug) return true;
    return false;
  }

  return function matchesShop(
    candidateName?: string | null,
    candidateDomain?: string | null,
  ): boolean {
    if (candidateName && candidateVariants(candidateName).some(variantMatches)) return true;
    if (candidateDomain) {
      const base = domainBase(candidateDomain);
      if (base && (base === norm || base === slugCompact)) return true;
    }
    return false;
  };
}
