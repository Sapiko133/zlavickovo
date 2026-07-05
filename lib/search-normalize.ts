/**
 * Normalizované vyhľadávanie (Fáza 2) — diakritika + whitespace + relevancia.
 *
 * Jediný zdroj pravdy pre porovnávanie vyhľadávacích dopytov s názvami
 * obchodov, kupónov a produktov. Nepoužíva sa na slugy/URL (lib/slug.ts)
 * ani na affiliate tracking.
 */

/**
 * "Dr. Max" → "dr max", "GymBeam" → "gymbeam", "Káva" → "kava",
 * "About-You" → "about you"
 */
export function normalizeSearchText(text: string): string {
  return (text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[.,\-_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalizovaný text bez medzier — "gym beam" aj "gymbeam" → "gymbeam". */
export function compactSearchText(text: string): string {
  return normalizeSearchText(text).replace(/ /g, "");
}

/**
 * Compact query nájdený na hranici slova kandidáta — "gym beam" matchne
 * "GymBeam proteín", ale "kava" nematchne "získavajte" (stred slova).
 */
function matchesAtTokenBoundary(normCandidate: string, compactQuery: string): boolean {
  if (!normCandidate || !compactQuery) return false;
  const tokens = normCandidate.split(" ");
  const joined = tokens.join("");
  let pos = 0;
  for (const t of tokens) {
    if (joined.startsWith(compactQuery, pos)) return true;
    pos += t.length;
  }
  return false;
}

/**
 * Relevancia zhody: 0 exact → 1 startsWith → 2 word boundary → 3 substring,
 * -1 = žiadna zhoda. Porovnáva normalizovanú aj compact formu, takže
 * "alza" → Alza (0), Alza.sk (1), AlzaPlus (1), MegaAlzaShop (3).
 */
export function searchMatchRank(candidate: string, query: string): number {
  const nc = normalizeSearchText(candidate);
  const nq = normalizeSearchText(query);
  if (!nc || !nq) return -1;
  const cc = nc.replace(/ /g, "");
  const cq = nq.replace(/ /g, "");
  if (nc === nq || cc === cq) return 0;
  if (nc.startsWith(nq) || cc.startsWith(cq)) return 1;
  if (matchesAtTokenBoundary(nc, cq)) return 2;
  if (cc.includes(cq)) return 3;
  return -1;
}

/** Zhoda vrátane substringu v strede slova — pre krátke názvy obchodov. */
export function matchesSearch(candidate: string, query: string): boolean {
  return searchMatchRank(candidate, query) >= 0;
}

/**
 * Prísnejšia zhoda len na hranici slova (bez mid-word substringu) — pre
 * dlhé texty kupónov a produktov, kde substring vyrába false positives
 * ("kava" ⊄ "získavajte").
 */
export function matchesSearchTokens(candidate: string, query: string): boolean {
  const cq = compactSearchText(query);
  if (!cq) return false;
  return matchesAtTokenBoundary(normalizeSearchText(candidate), cq);
}
