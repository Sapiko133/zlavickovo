/**
 * Zdieľaná konfigurácia importu Heureka feedov — jediný zdroj pravdy pre limit
 * počtu položiek, aby import.ts aj parser.ts používali rovnakú hodnotu.
 *
 * Limit je konfigurovateľný cez env `HEUREKA_MAX_ITEMS` (feature flag pre budúce
 * bezpečné zvyšovanie). Kým env nie je nastavený, správanie je ako doteraz:
 * 500 produktov na feed.
 */

/** Počet položiek na feed v audit/test režime. Full režim tento limit nepoužíva. */
export const HEUREKA_MAX_ITEMS: number = (() => {
  const raw = parseInt(process.env.HEUREKA_MAX_ITEMS ?? "", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 500;
})();

/** Tvrdý limit pre auditný smoke test, nezávislý od produkčného HEUREKA_MAX_ITEMS. */
export const HEUREKA_AUDIT_MAX_ITEMS = 100;

/** Predvolený počet feedov spracovaných jedným cron requestom. */
export const HEUREKA_IMPORT_BATCH_SIZE = 2;

/** Predvolený paralelizmus importu feedov. Konzervatívne kvôli Vercel/Neon limitom. */
export const HEUREKA_IMPORT_PARALLELISM = 1;

/** TTL DB locku pre jeden Heureka import request. */
export const HEUREKA_IMPORT_LOCK_TTL_MS = 10 * 60 * 1000;

/** Pri tomto čase sa request korektne ukončí pred Vercel maxDuration. */
export const HEUREKA_IMPORT_REQUEST_BUDGET_MS = 240 * 1000;

/** Audit request má vrátiť štruktúrovaný JSON pred bežným klientskym timeoutom. */
export const HEUREKA_AUDIT_REQUEST_BUDGET_MS = 90 * 1000;

/** Nový feed sa nezačne, ak v request budgete ostáva menej ako táto rezerva. */
export const HEUREKA_IMPORT_MIN_REMAINING_MS = 45 * 1000;

/** Tvrdý timeout jedného feedu v audit režime. */
export const HEUREKA_AUDIT_FEED_TIMEOUT_MS = 60 * 1000;

/** Timeout jedného feedu vo full režime. */
export const HEUREKA_FULL_FEED_TIMEOUT_MS = 60 * 1000;

/**
 * Núdzová brzda pre streamovaný download feedu (feedy s obrími položkami).
 * Konzervatívne 60 MB — pri budúcom limite 2000 nesmie orezať feed skôr, než sa
 * dosiahne HEUREKA_MAX_ITEMS. Stream sa aj tak primárne zastaví na počte položiek.
 */
export const HEUREKA_MAX_BYTES: number = 60 * 1024 * 1024;
