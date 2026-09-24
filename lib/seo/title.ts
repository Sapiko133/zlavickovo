/**
 * Inteligentná dĺžka <title> — namiesto mechanického strihania vyberá z
 * pripravených PRIRODZENÝCH variantov (od najinformatívnejšieho po najkratší).
 *
 * Priorita obsahu: kľúčové slovo / search intent → obchod (entita) → hlavná
 * informácia (mesiac/rok, sekundárne slová). Meno obchodu ani kľúčové slovo sa
 * nikdy neskracuje; ako prvé odpadajú sekundárne slová, potom dátum, až nakoniec
 * značka webu (" | Zlavickovo" z layout template).
 *
 * Google zobrazí ~580 px ≈ 60 znakov; TITLE_MAX je celková dĺžka vrátane značky.
 */
import { SITE_NAME } from "./config";

export const TITLE_MAX = 60;
export const BRAND_SUFFIX = ` | ${SITE_NAME}`;

export interface FittedTitle {
  /** Text bez značky (keď `absolute` = false, layout pridá " | Zlavickovo"). */
  text: string;
  /** true = titulok sa použije bez značky (Next metadata `title.absolute`). */
  absolute: boolean;
  /** Celková dĺžka, ako ju uvidí vyhľadávač. */
  length: number;
}

/**
 * Pre každý variant (od najinformatívnejšieho): najprv so značkou, potom bez nej —
 * značka webu má najnižšiu prioritu, dátum/hlavná informácia sa obetuje až potom.
 * Ak sa nezmestí nič, použije sa najkratší variant bez značky (radšej o pár
 * znakov dlhší prirodzený titulok než useknuté slovo).
 */
export function fitTitle(variants: string[], max = TITLE_MAX): FittedTitle {
  const list = variants.map((v) => v.replace(/\s+/g, " ").trim()).filter(Boolean);
  if (list.length === 0) throw new Error("fitTitle: žiadny variant");
  for (const v of list) {
    if (v.length + BRAND_SUFFIX.length <= max) return { text: v, absolute: false, length: v.length + BRAND_SUFFIX.length };
    if (v.length <= max) return { text: v, absolute: true, length: v.length };
  }
  const shortest = [...list].sort((a, b) => a.length - b.length)[0];
  return { text: shortest, absolute: true, length: shortest.length };
}

/** Next.js Metadata `title` z FittedTitle. */
export function metadataTitle(t: FittedTitle): string | { absolute: string } {
  return t.absolute ? { absolute: t.text } : t.text;
}

export function shopTitleVariants(name: string, hasCodes: boolean, month: string, year: number): string[] {
  return hasCodes
    ? [
        `${name} zľavové kódy a kupóny – ${month} ${year}`,
        `${name} zľavové kódy – ${month} ${year}`,
        `${name} zľavové kódy ${year}`,
        `${name} zľavové kódy`,
      ]
    : [
        `${name} akcie a zľavové kódy – ${month} ${year}`,
        `${name} akcie a zľavy – ${month} ${year}`,
        `${name} akcie a zľavy ${year}`,
        `${name} akcie a zľavy`,
      ];
}

export function categoryTitleVariants(label: string, month: string, year: number): string[] {
  return [
    `${label} – akcie, zľavy a zľavové kódy ${month} ${year}`,
    `${label} – akcie a zľavové kódy ${month} ${year}`,
    `${label} – akcie a zľavové kódy ${year}`,
    `${label} akcie a zľavové kódy`,
  ];
}

/**
 * Akcia: "Obchod: text akcie". Varianty skracujú na PRIROZENEJ hranici
 * (koniec vety / klauzuly), nie uprostred slova; obchod ostáva vpredu.
 */
export function offerTitleVariants(shop: string, rawTitle: string): string[] {
  const body = rawTitle.replace(/^[^:]{1,40}:\s*/, "").replace(/\s+/g, " ").trim().replace(/[.,;]$/, "");
  const shopClean = shop.trim();
  const shopInBody = shopClean && body.toLowerCase().includes(shopClean.toLowerCase().replace(/\.(sk|cz|com)$/, ""));
  const withShop = (b: string) => (shopClean && !shopInBody ? `${shopClean}: ${b}` : b);
  const out = [withShop(body)];
  // Prirodzené hranice: veta, pomlčka, zátvorka, čiarka.
  for (const sep of [/\.\s+/, /\s+[–-]\s+/, /\s*\(/, /,\s+/]) {
    const first = body.split(sep)[0].trim();
    // Zmysluplný úsek: aspoň 3 slová a 20 znakov (nie "Bundy" z "Bundy, kabáty a mikiny…").
    if (first.length >= 20 && first.split(" ").length >= 3 && first.length < body.length) out.push(withShop(first));
  }
  return [...new Set(out)];
}
