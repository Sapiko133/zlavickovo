/**
 * Cross-source deduplikácia ponúk — jedna kanonická ponuka + alternatívne zdroje.
 * Čistý modul bez DB/siete (testovateľný samostatne, scripts/test-offer-dedupe.ts).
 *
 * Princíp (audit §4.3): tá istá ponuka z dvoch sietí (napr. Bonprix z Dognetu aj
 * Affialu) sa má zobraziť RAZ. Odlišný kód alebo odlišná platnosť sa NEZLÚČIA.
 * Fuzzy title-matching sa zámerne nepoužíva — merge je deterministický a
 * konzervatívny, aby sa nezlepili dva rôzne dealy.
 */

import { normalizeShopSlug } from "@/lib/slug";
import { normalizeSearchText } from "@/lib/search-normalize";

export interface DedupeOffer {
  /** Zdroj/sieť: dognet | affial | ehub | cj | static | manual … */
  source: string;
  shopSlug?: string | null;
  shopName?: string | null;
  code?: string | null;
  title?: string | null;
  discountPct?: number | null;
  /** Koniec platnosti — odlišná platnosť je odlišná ponuka. */
  validTo?: string | null;
  /** Identita produktu (EAN/URL), keď ide o produktovú ponuku. */
  productKey?: string | null;
}

export interface CanonicalOffer<T extends DedupeOffer> {
  fingerprint: string;
  /** Reprezentatívna ponuka skupiny (najúplnejšie dáta, stabilný výber). */
  canonical: T;
  /** Všetky ponuky skupiny vrátane kanonickej, v deterministickom poradí. */
  sources: T[];
}

/** Poradie zdrojov pre stabilný výber kanonickej ponuky (nie monetizácia). */
const SOURCE_ORDER = ["dognet", "affial", "ehub", "cj", "static", "manual"];

function sourceRank(source: string): number {
  const index = SOURCE_ORDER.indexOf(source);
  return index === -1 ? SOURCE_ORDER.length : index;
}

function canonicalShop(offer: DedupeOffer): string {
  const raw = offer.shopSlug || offer.shopName || "";
  return normalizeShopSlug(raw);
}

function canonicalCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

/**
 * Deterministický fingerprint. Kupón s kódom sa identifikuje obchodom + kódom
 * (rovnaký kód z dvoch sietí = jedna ponuka). Akcia bez kódu obchodom +
 * normalizovaným názvom + zľavou + platnosťou. Produktová identita, ak je,
 * pripúta ponuku k danému produktu.
 */
export function offerFingerprint(offer: DedupeOffer): string {
  const shop = canonicalShop(offer);
  const productKey = offer.productKey ? `#${offer.productKey.trim().toLowerCase()}` : "";
  const code = offer.code?.trim();

  if (code) {
    return `code:${shop}:${canonicalCode(code)}${productKey}`;
  }

  const title = normalizeSearchText(offer.title ?? "");
  const discount = offer.discountPct != null ? String(offer.discountPct) : "";
  const validity = (offer.validTo ?? "").trim();
  return `deal:${shop}:${title}:${discount}:${validity}${productKey}`;
}

/** Úplnosť dát ponuky — vyššie skóre = lepší kandidát na kanonickú. */
function completeness(offer: DedupeOffer): number {
  let score = 0;
  if (offer.code?.trim()) score += 4;
  if (offer.validTo?.trim()) score += 2;
  if (offer.discountPct != null) score += 1;
  score += Math.min(3, Math.floor((offer.title?.trim().length ?? 0) / 20));
  return score;
}

/**
 * Zoskupí ponuky podľa fingerprintu. Zachováva poradie prvého výskytu skupiny
 * (rovnaký vstup → rovnaký výstup). V rámci skupiny sú zdroje zoradené stabilne
 * a kanonická je najúplnejšia ponuka.
 */
export function dedupeOffers<T extends DedupeOffer>(offers: T[]): CanonicalOffer<T>[] {
  const groups = new Map<string, T[]>();
  const order: string[] = [];

  for (const offer of offers) {
    const fp = offerFingerprint(offer);
    const bucket = groups.get(fp);
    if (bucket) {
      bucket.push(offer);
    } else {
      groups.set(fp, [offer]);
      order.push(fp);
    }
  }

  return order.map((fp) => {
    const bucket = groups.get(fp)!;
    const sources = [...bucket].sort((a, b) => {
      const byComplete = completeness(b) - completeness(a);
      if (byComplete !== 0) return byComplete;
      const bySource = sourceRank(a.source) - sourceRank(b.source);
      if (bySource !== 0) return bySource;
      return (a.title ?? "").localeCompare(b.title ?? "");
    });
    return { fingerprint: fp, canonical: sources[0], sources };
  });
}
