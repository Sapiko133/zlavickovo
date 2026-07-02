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

/**
 * Vytvorí matcher pre obchod zo slug-u / názvu stránky obchodu.
 * Porovnáva normalizovaný názov, slug aj doménu, takže
 * "Alza.sk", "Alza", "alza.sk" aj "alza" patria pod /kupony/alza.
 *
 * Nezávisí od presného názvu — substring match beží nad normalizovanými
 * tvarmi (min. 4 znaky, aby "dm" nechytalo cudzie obchody).
 */
export function createShopMatcher(shopName: string) {
  const slug = normalizeShopSlug(shopName);
  const slugCompact = slug.replace(/-/g, "");
  const norm = normalizeShopName(shopName);

  return function matchesShop(
    candidateName?: string | null,
    candidateDomain?: string | null,
  ): boolean {
    if (candidateName) {
      const candNorm = normalizeShopName(candidateName);
      if (candNorm && (candNorm === norm || candNorm === slugCompact)) return true;
      if (slug && normalizeShopSlug(candidateName) === slug) return true;
      // "Alza.cz + Alza.sk" → "alzaczalza" obsahuje "alza"
      if (norm.length >= 4 && candNorm.includes(norm)) return true;
    }
    if (candidateDomain) {
      const base = domainBase(candidateDomain);
      if (base && (base === norm || base === slugCompact)) return true;
    }
    return false;
  };
}
