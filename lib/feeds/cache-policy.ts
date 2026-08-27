/**
 * Vercel importy bežia raz denne. Redis dáta preto musia prežiť aj mierne
 * oneskorený alebo jeden neúspešný beh; presne 24 h TTL vytvára okno bez dát.
 */
export const DAILY_REFRESH_INTERVAL_SECONDS = 24 * 60 * 60;
export const DAILY_REFRESH_CACHE_TTL_SECONDS = 36 * 60 * 60;

/** Krátka procesová memoizácia obmedzuje opakované API volania v jednom procese. */
export const PROCESS_MEMO_TTL_SECONDS = 60 * 60;

