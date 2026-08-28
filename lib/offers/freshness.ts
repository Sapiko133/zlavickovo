/**
 * Kanonický freshness model pre kupóny a akcie — jediné miesto, ktoré rozhoduje,
 * či je ponuka aktívna. Čistý modul bez DB, siete a env (testovateľný samostatne,
 * scripts/test-offer-freshness.ts).
 *
 * Princípy (PROJECT_VISION §8, audit §4.2):
 * - Chýbajúce údaje sa NEVYMÝŠĽAJÚ. Absencia expirácie != nulová platnosť.
 * - Prítomný, ale nedôveryhodný (neparsovateľný) dátum sa NEvydáva za aktívny;
 *   taká ponuka je "unknown" a vyradí sa z aktívnych merge výsledkov.
 * - Hranice dní sa počítajú v Europe/Bratislava vrátane letného času (DST).
 * - Bežné SK/CZ formáty (DD.MM.YYYY) sú prvotriedne, nie iba ISO.
 */

export const OFFER_TIME_ZONE = "Europe/Bratislava";

export type FreshnessStatus =
  | "active" // platí a máme dôveryhodný dátum konca
  | "active_no_expiry" // platí, ale žiadny dátum konca nepoznáme (žiadny countdown!)
  | "not_started" // začiatok je v budúcnosti
  | "expired" // dôveryhodný dátum konca už prešiel
  | "unknown"; // dátum je prítomný, ale neparsovateľný — nepovažuj za aktívny

export interface FreshnessInput {
  /** Koniec platnosti (validTo / valid_to / endDate / expires). */
  expiresAt?: string | null;
  /** Začiatok platnosti, ak ho zdroj uvádza. */
  startsAt?: string | null;
  /** Skutočný verifikačný event — NIE čas importu. */
  lastVerifiedAt?: string | null;
  /** Kedy zdroj naposledy potvrdil záznam (import/fetch). */
  sourceUpdatedAt?: string | null;
}

export interface Freshness {
  status: FreshnessStatus;
  /** Normalizovaný ISO reťazec alebo null, keď dátum nepoznáme/je neplatný. */
  expiresAt: string | null;
  startsAt: string | null;
  lastVerifiedAt: string | null;
  /**
   * Odvodený signál dôveryhodnosti 0..1 z REÁLNE prítomných údajov.
   * Slúži iba na ranking; nikdy sa nezobrazuje ako "overené".
   */
  confidence: number;
}

interface ParsedDate {
  /** UTC ms príslušného okamihu, alebo null keď hodnota chýba/je neplatná. */
  ms: number | null;
  /** Bola vôbec zadaná nejaká hodnota? */
  present: boolean;
  /** Ak bola zadaná, dala sa spoľahlivo rozparsovať? */
  valid: boolean;
  /** Bol to dátum bez času (počíta sa hranica dňa v lokálnej zóne)? */
  dateOnly: boolean;
}

const DATE_ONLY_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_ONLY_DMY = /^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/;

/** DST-správny prevod lokálneho wall-clock času v danej zóne na UTC ms. */
function zonedWallClockToUtcMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  ms: number,
): number {
  // Milisekundy držíme mimo offset výpočtu — formatToParts ich nevracia, takže
  // by inak spôsobili ~1 s posun na hranici dňa.
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second, 0);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: OFFER_TIME_ZONE,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(new Date(utcGuess));
  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour) === 24 ? 0 : Number(map.hour),
    Number(map.minute),
    Number(map.second),
  );
  const offset = asUtc - utcGuess;
  return utcGuess - offset + ms;
}

/** Koniec kalendárneho dňa (23:59:59.999) v Europe/Bratislava ako UTC ms. */
function endOfLocalDayMs(year: number, month: number, day: number): number {
  return zonedWallClockToUtcMs(year, month, day, 23, 59, 59, 999);
}

/** Začiatok kalendárneho dňa (00:00:00.000) v Europe/Bratislava ako UTC ms. */
function startOfLocalDayMs(year: number, month: number, day: number): number {
  return zonedWallClockToUtcMs(year, month, day, 0, 0, 0, 0);
}

function parseDate(raw: string | null | undefined, dayBoundary: "start" | "end"): ParsedDate {
  if (raw == null || String(raw).trim() === "") {
    return { ms: null, present: false, valid: true, dateOnly: false };
  }
  const value = String(raw).trim();

  const iso = DATE_ONLY_ISO.exec(value);
  if (iso) {
    const [, y, m, d] = iso;
    const ms = dayBoundary === "end"
      ? endOfLocalDayMs(Number(y), Number(m), Number(d))
      : startOfLocalDayMs(Number(y), Number(m), Number(d));
    return { ms, present: true, valid: true, dateOnly: true };
  }

  const dmy = DATE_ONLY_DMY.exec(value);
  if (dmy) {
    const [, d, m, y] = dmy;
    const day = Number(d);
    const month = Number(m);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const ms = dayBoundary === "end"
        ? endOfLocalDayMs(Number(y), month, day)
        : startOfLocalDayMs(Number(y), month, day);
      return { ms, present: true, valid: true, dateOnly: true };
    }
    return { ms: null, present: true, valid: false, dateOnly: false };
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return { ms: parsed.getTime(), present: true, valid: true, dateOnly: false };
  }

  return { ms: null, present: true, valid: false, dateOnly: false };
}

const DAY_MS = 86_400_000;

function computeConfidence(input: {
  hasValidExpiry: boolean;
  lastVerifiedMs: number | null;
  sourceUpdatedMs: number | null;
  now: number;
}): number {
  let score = 0.5; // neutrálny základ; žiadny údaj neznamená vysokú dôveru
  if (input.hasValidExpiry) score += 0.2;
  if (input.lastVerifiedMs != null) {
    const ageDays = (input.now - input.lastVerifiedMs) / DAY_MS;
    score += ageDays <= 7 ? 0.3 : ageDays <= 30 ? 0.15 : 0;
  } else if (input.sourceUpdatedMs != null) {
    const ageDays = (input.now - input.sourceUpdatedMs) / DAY_MS;
    score += ageDays <= 2 ? 0.1 : 0;
  }
  return Math.max(0, Math.min(1, Number(score.toFixed(3))));
}

/**
 * Vyhodnotí freshness ponuky voči `now` (default aktuálny čas).
 * Neplatný, ale prítomný dátum konca => "unknown" (nie aktívny).
 */
export function evaluateFreshness(input: FreshnessInput, now: number = Date.now()): Freshness {
  const expiry = parseDate(input.expiresAt, "end");
  const start = parseDate(input.startsAt, "start");
  const verified = parseDate(input.lastVerifiedAt, "end");
  const sourceUpdated = parseDate(input.sourceUpdatedAt, "end");

  let status: FreshnessStatus;
  if (expiry.present && !expiry.valid) {
    status = "unknown";
  } else if (start.present && start.valid && start.ms != null && start.ms > now) {
    status = "not_started";
  } else if (expiry.present && expiry.valid && expiry.ms != null) {
    status = expiry.ms >= now ? "active" : "expired";
  } else {
    status = "active_no_expiry";
  }

  return {
    status,
    expiresAt: expiry.valid && expiry.ms != null ? new Date(expiry.ms).toISOString() : null,
    startsAt: start.valid && start.ms != null ? new Date(start.ms).toISOString() : null,
    lastVerifiedAt: verified.valid && verified.ms != null ? new Date(verified.ms).toISOString() : null,
    confidence: computeConfidence({
      hasValidExpiry: expiry.present && expiry.valid,
      lastVerifiedMs: verified.valid ? verified.ms : null,
      sourceUpdatedMs: sourceUpdated.valid ? sourceUpdated.ms : null,
      now,
    }),
  };
}

/**
 * Má sa ponuka zobraziť medzi AKTÍVNYMI? Kanonická náhrada za roztrúsené
 * isActive()/notExpired(). Neznámy ani neplatný dátum sa nepovažuje za aktívny.
 */
export function isOfferActive(input: FreshnessInput | string | null | undefined, now: number = Date.now()): boolean {
  const normalized: FreshnessInput = typeof input === "string" || input == null ? { expiresAt: input ?? null } : input;
  const status = evaluateFreshness(normalized, now).status;
  return status === "active" || status === "active_no_expiry";
}
