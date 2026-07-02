/**
 * Odstráni interné Dognet artefakty z názvu kampane, aby ostal čistý názov obchodu.
 * Idempotentné — bezpečné aj na už čistých názvoch.
 *
 * "Allegro.sk (for voucher)"              → "Allegro.sk"
 * "Bonprix.sk (for voucher publishers)"   → "Bonprix.sk"
 * "4fstore.sk (voucher publisher)"        → "4fstore.sk"
 * "4fstore.cz (cashback publisher)"       → "4fstore.cz"
 * "SI - Housebrand.com (for content)"     → "SI - Housebrand.com"
 * "Balabim.sk (pôvodné UzasneDarceky.sk)" → "Balabim.sk"
 * "Zapatos.sk (shutting down 31.7.2026)"  → "Zapatos.sk"
 */
export function cleanDognetShopName(name: string): string {
  if (!name) return name;
  return name
    .replace(/\s*\((?:for\s+)?(?:voucher|cashback|content)(?:\s+publishers?)?\)$/i, "")
    .replace(/\s*\(p[ôo]vodn[éeáí][^)]*\)$/i, "")
    .replace(/\s*\(shutting\s+down[^)]*\)$/i, "")
    .trim();
}
