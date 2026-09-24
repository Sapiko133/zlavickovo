/**
 * Bezpečná normalizácia textov z affiliate feedov (data quality).
 * Nič nevymýšľa — iba odstraňuje technický šum: HTML tagy/entity, zlomy riadkov,
 * viacnásobné medzery. Čistý modul (scripts/test-offer-text.ts).
 */

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—",
  hellip: "…", euro: "€", bdquo: "„", ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’",
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[body.toLowerCase()] ?? m;
  });
}

/** Text z feedu → jeden riadok bez HTML a nadbytočných medzier. */
export function cleanFeedText(value: unknown): string {
  if (value == null) return "";
  return decodeEntities(String(value).replace(/<br\s*\/?>/gi, " ").replace(/<[^>]{1,200}>/g, " "))
    .replace(/[​-‍﻿]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export const MAX_OFFER_TITLE = 110;

function clampAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const at = cut.lastIndexOf(" ");
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,;:–-]+$/, "")}…`;
}

/**
 * Titulok ponuky: niektoré siete vkladajú do titulku celý odsek. Zo samotného
 * textu vyberie najinformatívnejšiu vetu (so zľavou/dopravou zadarmo), inak
 * prvú dostatočne dlhú vetu; nikdy nepridáva vlastné slová.
 */
export function offerTitle(raw: unknown): string {
  const text = cleanFeedText(raw);
  if (text.length <= MAX_OFFER_TITLE) return text;
  const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const informative = sentences.find((s) => /\d\s*%|zadarmo|zdarma|zľav|slev/i.test(s) && s.length >= 20);
  const firstLong = sentences.find((s) => s.length >= 25);
  return clampAtWord(informative ?? firstLong ?? text, MAX_OFFER_TITLE);
}
