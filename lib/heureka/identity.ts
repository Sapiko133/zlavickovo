/**
 * Validácia identifikátorov produktu (PROJECT_VISION §8): silná identita
 * (EAN, manufacturer+productno) sa smie použiť na spájanie ponúk len ak je
 * dôveryhodná. Audit matchingu ukázal, že placeholder hodnoty (productno
 * "N/A", EAN zo samých núl) spájali celé značky a nesúvisiace produkty —
 * nevalidná identita preto znamená, že identita NEEXISTUJE (null) a matching
 * musí prejsť na ďalší, slabší krok.
 *
 * Čistý modul bez DB a env — testovateľný samostatne (scripts/test-identity.ts).
 */

/** Sila zhody, na základe ktorej boli ponuky spojené. */
export type IdentityLevel = "ean" | "manufacturer_productno" | "name";

// ---- EAN / GTIN ----

const GTIN_LENGTHS = new Set([8, 12, 13, 14]);

// Známe placeholder EAN-y nad rámec všeobecných pravidiel nižšie
const PLACEHOLDER_EANS = new Set(["1234567890123"]);

// GTIN-8/12/13/14 — pad na 14 číslic, váhy 3/1 zľava, posledná = kontrolná
function gtinChecksumValid(digits: string): boolean {
  const padded = digits.padStart(14, "0");
  let sum = 0;
  for (let i = 0; i < 13; i++) sum += Number(padded[i]) * (i % 2 === 0 ? 3 : 1);
  return (10 - (sum % 10)) % 10 === Number(padded[13]);
}

/**
 * Placeholder EAN: samé nuly ("0000000000000"), jedna opakovaná číslica
 * ("1111111111111", "9999999999999"), samé nuly s jednou koncovou číslicou
 * ("0000000000002") a známe sekvencie ("1234567890123").
 */
export function isPlaceholderEan(digits: string): boolean {
  if (/^(\d)\1+$/.test(digits)) return true;
  if (/^0+\d$/.test(digits)) return true;
  return PLACEHOLDER_EANS.has(digits);
}

/**
 * Normalizovaný EAN alebo null, ak identita nie je dôveryhodná.
 * Použiteľný EAN: iba číslice (po odstránení medzier a pomlčiek), dĺžka
 * GTIN-8/12/13/14, nie placeholder, platný GTIN checksum.
 */
export function normalizeEan(raw?: string | null): string | null {
  const digits = (raw ?? "").replace(/[\s -]/g, "");
  if (!digits || !/^\d+$/.test(digits)) return null;
  if (!GTIN_LENGTHS.has(digits.length)) return null;
  if (isPlaceholderEan(digits)) return null;
  if (!gtinChecksumValid(digits)) return null;
  return digits;
}

export function isValidEan(raw?: string | null): boolean {
  return normalizeEan(raw) !== null;
}

// ---- manufacturer / productno ----

// Placeholder tokeny (case-insensitive) — hodnoty, ktoré feedy používajú
// namiesto chýbajúceho údaja a nesmú vytvoriť zhodu.
const PLACEHOLDER_TOKENS = new Set([
  "n/a",
  "na",
  "n.a.",
  "-",
  "--",
  "---",
  "0",
  "x",
  "xx",
  "xxx",
  "unknown",
  "null",
  "none",
  "nil",
  "?",
]);

/**
 * Normalizovaný výrobca (trim, lowercase, collapse whitespace) alebo null.
 * Placeholder hodnoty ("N/A", "-", "unknown"...) sa konzervatívne odmietajú —
 * výrobca "n/a" by inak zoskupil produkty naprieč značkami.
 */
export function normalizeManufacturer(raw?: string | null): string | null {
  const value = (raw ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!value || PLACEHOLDER_TOKENS.has(value)) return null;
  return value;
}

/**
 * Normalizované productno (trim, collapse whitespace; case sa zachováva)
 * alebo null. Odmieta placeholder tokeny, čistú interpunkciu, samé nuly
 * a extrémne krátke hodnoty (< 3 znaky), ak nejde o čisto číselný model.
 */
export function normalizeProductNo(raw?: string | null): string | null {
  const value = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!value) return null;
  if (PLACEHOLDER_TOKENS.has(value.toLowerCase())) return null;
  if (/^[-–—_.,:;?*#/\\]+$/.test(value)) return null;
  if (/^0+$/.test(value)) return null;
  if (value.length < 3 && !/^\d+$/.test(value)) return null;
  return value;
}

/**
 * Najsilnejšia DÔVERYHODNÁ identita produktu (PROJECT_VISION §8):
 * EAN → manufacturer+productno (len ak sú obe hodnoty validné) → name.
 */
export function getIdentityLevel(product: {
  ean?: string | null;
  manufacturer?: string | null;
  productno?: string | null;
}): IdentityLevel {
  if (normalizeEan(product.ean)) return "ean";
  if (normalizeManufacturer(product.manufacturer) && normalizeProductNo(product.productno)) {
    return "manufacturer_productno";
  }
  return "name";
}
