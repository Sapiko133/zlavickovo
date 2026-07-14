/**
 * Kľúč pre zlúčenie veľkostných/variantných verzií toho istého produktu (§8/§18).
 * Bez diakritiky, odseknutý veľkostný sufix ("... Veľkosť EU: 42", "Velikost: 9.5").
 * Pán/dáma (M/W) a modelové čísla ostávajú zachované → rozdielne produkty sa
 * nezlúčia. Používa sa v zoznamoch (poklesy cien, produkty obchodu), kde nemá
 * zmysel zobrazovať tú istú topánku vo viacerých veľkostiach ako samostatné položky.
 */
export function variantBaseKey(name: string): string {
  const base = (name || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\b(velkost|velikost|size|vel)\b.*$/, "")
    .replace(/\s+/g, " ")
    .trim();
  return base || (name || "").toLowerCase().trim();
}
