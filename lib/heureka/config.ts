/**
 * Zdieľaná konfigurácia importu Heureka feedov — jediný zdroj pravdy pre limit
 * počtu položiek, aby import.ts aj parser.ts používali rovnakú hodnotu.
 *
 * Limit je konfigurovateľný cez env `HEUREKA_MAX_ITEMS` (feature flag pre budúce
 * bezpečné zvyšovanie). Kým env nie je nastavený, správanie je ako doteraz:
 * 500 produktov na feed.
 */

/** Počet položiek na feed. Default 500 (nezmenené správanie bez env). */
export const HEUREKA_MAX_ITEMS: number = (() => {
  const raw = parseInt(process.env.HEUREKA_MAX_ITEMS ?? "", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 500;
})();

/**
 * Núdzová brzda pre streamovaný download feedu (feedy s obrími položkami).
 * Konzervatívne 60 MB — pri budúcom limite 2000 nesmie orezať feed skôr, než sa
 * dosiahne HEUREKA_MAX_ITEMS. Stream sa aj tak primárne zastaví na počte položiek.
 */
export const HEUREKA_MAX_BYTES: number = 60 * 1024 * 1024;
