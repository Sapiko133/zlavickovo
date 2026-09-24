/**
 * Centrálna SEO konfigurácia — jediný zdroj pre kanonickú doménu a značku.
 * Kanonická forma URL: https + www, malé písmená, bez koncového lomítka
 * (Next.js 308 presmeruje "/x/" → "/x"), bez tracking parametrov.
 */
export const SITE_URL = "https://www.zlavickovo.sk";
export const SITE_NAME = "Zlavickovo";

/** Absolútna kanonická URL pre cestu ("/kupony/alza" → "https://www.zlavickovo.sk/kupony/alza"). */
export function absoluteUrl(path = "/"): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (!path || path === "/") return SITE_URL;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${p.replace(/\/+$/, "")}`;
}

/** Parametre, ktoré nikdy nemenia obsah stránky (canonical ich vždy zahodí). */
export const TRACKING_PARAMS = [
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "gclid", "fbclid", "msclkid", "yclid", "ref", "mc_cid", "mc_eid", "_ga",
];

/** Robots pre stránky, ktoré majú odovzdať link equity, ale nemajú byť v indexe. */
export const NOINDEX_FOLLOW = { index: false, follow: true } as const;

/**
 * Poistka proti titulkom typu "Akcie | Akcie | Zľavy | Zlavickovo":
 * odstráni susedné duplicitné segmenty a značku (tú pridáva layout template).
 */
export function cleanTitle(raw: string): string {
  const parts = raw
    .split(/\s+[|·–-]\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => s.toLowerCase() !== SITE_NAME.toLowerCase());
  const out: string[] = [];
  for (const p of parts) {
    if (out.length && out[out.length - 1].toLowerCase() === p.toLowerCase()) continue;
    out.push(p);
  }
  return out.join(" – ");
}

/** Skráti meta description na hranici slova (Google zobrazí ~155–160 znakov). */
export function clampDescription(text: string, max = 158): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const at = cut.lastIndexOf(" ");
  return `${(at > 80 ? cut.slice(0, at) : cut).replace(/[,;:–-]\s*$/, "")}…`;
}

/** Slovenské skloňovanie počtu: 1 kód, 2–4 kódy, 5+ kódov. */
export function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  if (n >= 2 && n <= 4) return few;
  return many;
}
