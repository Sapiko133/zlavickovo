/**
 * Deal score — skladá SAMOSTATNÉ dôkazy do jedného skóre (master §10, audit §10).
 * Čistý modul bez DB/siete (testovateľný samostatne, scripts/test-deal-score.ts).
 *
 * Zásady dôvery:
 * - Reálny pozorovaný pokls z cenovej histórie váži VIAC než deklarované % zľavy.
 * - Deklarované % (merchant discount) je slabý, stropovaný signál — umelá -90 %
 *   ponuka bez histórie NESMIE poraziť dôveryhodný menší pokls.
 * - Bez dostatočnej histórie sa NEGENERUJE claim o poklese ani o historickom minime.
 * - MONETIZÁCIA (provízia, affiliate) NIE JE vstupom skóre.
 * - Skóre pracuje s percentami a príznakmi, nie s absolútnou cenou/menou —
 *   je currency-agnostické a nemieša varianty (izoláciu rieši volajúci + Variant Guard).
 */

export type FreshnessLike =
  | "active"
  | "active_no_expiry"
  | "not_started"
  | "expired"
  | "unknown";

export interface DealEvidence {
  /** Deklarované % zľavy z textu/feedu (slabý signál). */
  merchantDiscountPct?: number | null;
  /** Reálny pokls voči predchádzajúcej cene z histórie (silný signál). */
  observedDropPct?: number | null;
  /** Je aktuálna cena historickým minimom v sledovanom okne? */
  atHistoricalLow?: boolean;
  /** Počet dní dostupnej histórie — dôvera v drop/low. */
  historyDays?: number | null;
  /** Stav čerstvosti ponuky. */
  freshness?: FreshnessLike;
  /** 0..1 z freshness modelu. */
  confidence?: number | null;
  /** 0..1 z click/search agregácie. */
  popularity?: number | null;
  /** 0..1 kvalita obchodu. */
  shopQuality?: number | null;
  /** Ponuka má kupónový kód. */
  hasCoupon?: boolean;
}

export interface DealScore {
  /** 0..100. */
  score: number;
  components: {
    observedDrop: number;
    historicalLow: number;
    merchantDiscount: number;
    popularity: number;
    shopQuality: number;
    coupon: number;
  };
  /** Dá sa najsilnejší claim doložiť? (false = len deklarovaná veľká zľava). */
  trustworthy: boolean;
}

const HISTORY_TRUST_DAYS = 14;
const HISTORICAL_LOW_MIN_DAYS = 7;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function num(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function historyTrust(historyDays: number | null | undefined): number {
  return clamp(num(historyDays) / HISTORY_TRUST_DAYS, 0, 1);
}

export function scoreDeal(evidence: DealEvidence): DealScore {
  const trust = historyTrust(evidence.historyDays);

  // Reálny pokls: až 55 bodov, škálovaný dôverou v históriu. Bez histórie 0.
  const observedDrop = clamp(num(evidence.observedDropPct), 0, 70) / 70 * 55 * trust;

  // Historické minimum: bonus len s dostatočnou históriou.
  const historicalLow =
    evidence.atHistoricalLow && num(evidence.historyDays) >= HISTORICAL_LOW_MIN_DAYS ? 12 : 0;

  // Deklarovaná zľava: slabý, stropovaný signál (max 12 bodov).
  const merchantDiscount = clamp(num(evidence.merchantDiscountPct), 0, 70) / 70 * 12;

  const popularity = clamp(num(evidence.popularity), 0, 1) * 8;
  const shopQuality = clamp(num(evidence.shopQuality), 0, 1) * 5;
  const coupon = evidence.hasCoupon ? 5 : 0;

  const raw = observedDrop + historicalLow + merchantDiscount + popularity + shopQuality + coupon;

  // Confidence a čerstvosť jemne modulujú výsledok; expirovaná/nezačatá ponuka
  // sa výrazne potlačí (nemá byť medzi najlepšími aktívnymi dealmi).
  const confidenceMult = 0.75 + 0.25 * clamp(num(evidence.confidence), 0, 1);
  const freshnessMult =
    evidence.freshness === "expired" || evidence.freshness === "not_started"
      ? 0.2
      : evidence.freshness === "unknown"
        ? 0.85
        : 1;

  const score = clamp(raw * confidenceMult * freshnessMult, 0, 100);

  // Nedôveryhodné = veľká deklarovaná zľava bez akéhokoľvek doloženia.
  const hasRealEvidence = observedDrop > 0 || historicalLow > 0;
  const trustworthy = hasRealEvidence || num(evidence.merchantDiscountPct) <= 50;

  return {
    score: Number(score.toFixed(2)),
    components: {
      observedDrop: Number(observedDrop.toFixed(2)),
      historicalLow,
      merchantDiscount: Number(merchantDiscount.toFixed(2)),
      popularity: Number(popularity.toFixed(2)),
      shopQuality: Number(shopQuality.toFixed(2)),
      coupon,
    },
    trustworthy,
  };
}
