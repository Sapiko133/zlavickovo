import {
  convertCzkToEur,
  getEurToCzkRate,
  parsePriceValue,
  resolveProductCurrency,
  type SupportedCurrency,
} from "../price";
import type { IdentityLevel } from "./identity";

/**
 * Výber „Najvýhodnejšej kúpy" — čistá ranking logika bez DB a env, testovateľná
 * samostatne. Kandidátov dodáva getBestPurchase (lib/heureka/query.ts).
 *
 * Pravidlá (PROJECT_VISION §9):
 * 1. najnižšia platná cena (pri mixe mien normalizovaná na EUR cez centrálny kurz),
 * 2. pri zhode ceny ponuka s monetizovaným affiliate linkom,
 * 3. doména abecedne (stabilný tie-breaker).
 *
 * EUR a CZK sa NIKDY neporovnávajú ako surové čísla. Ponuka bez rozpoznateľnej
 * meny alebo bez kurzu pri mixe mien sa z porovnania vylúči (excludedCount) —
 * nesmie dostať badge „najnižšia cena" voči inej mene.
 */

export interface BestPurchaseCandidate {
  id: number;
  name: string;
  price?: string | number | null;
  currency_code?: string | null;
  domain?: string | null;
  affiliate_url?: string | null;
  url?: string | null;
  ean?: string | null;
}

export interface BestPurchaseOffer {
  id: number;
  name: string;
  price: string;
  priceNum: number;
  currency_code: SupportedCurrency;
  /** Porovnávacia hodnota v EUR; null ak CZK ponuka nemá dostupný kurz. */
  comparableEur: number | null;
  domain: string;
  affiliate_url: string | null;
  url: string | null;
  ean: string;
}

export interface BestPurchase {
  lowestOffer: BestPurchaseOffer;
  secondOffer: BestPurchaseOffer | null;
  /**
   * Všetky porovnané ponuky zoradené rankingom — najlepšia platná ponuka za
   * každú doménu, offers[0] === lowestOffer. Ponuky vylúčené z porovnania
   * (neplatná cena/URL, neporovnateľná mena) tu nie sú.
   */
  offers: BestPurchaseOffer[];
  /** Rozdiel voči 2. ponuke v mene lowestOffer; null ak je 2. ponuka v inej mene. */
  priceDifference: number | null;
  /** Počet porovnaných ponúk (unikátne domény). */
  offerCount: number;
  /** Ponuky vylúčené z porovnania (neplatná cena/URL, neznáma mena, chýbajúci kurz pri mixe mien). */
  excludedCount: number;
  /** „Najnižšia cena" možno tvrdiť len ak sa reálne porovnali aspoň 2 ponuky. */
  isLowestVerified: boolean;
  /**
   * Sila identity, ktorou boli ponuky spojené (PROJECT_VISION §8) — UI podľa
   * nej rozhoduje, či smie tvrdiť „Najvýhodnejšia kúpa"/„Najnižšia cena" (len
   * "ean"), alebo musí použiť opatrnejší text.
   */
  identityLevel: IdentityLevel;
}

function cleanUrl(value?: string | null): string | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return trimmed;
  } catch {
    return null;
  }
}

function toOffer(candidate: BestPurchaseCandidate, eurToCzkRate: number | null): BestPurchaseOffer | null {
  const domain = (candidate.domain ?? "").trim();
  const affiliateUrl = cleanUrl(candidate.affiliate_url);
  const url = cleanUrl(candidate.url);
  const priceNum = parsePriceValue(candidate.price);
  const currency = resolveProductCurrency(candidate.price, candidate.currency_code, candidate.domain);
  if (!domain || priceNum === null || !currency || (!url && !affiliateUrl)) return null;

  return {
    id: candidate.id,
    name: candidate.name,
    price: String(candidate.price ?? ""),
    priceNum,
    currency_code: currency,
    comparableEur: currency === "EUR" ? priceNum : convertCzkToEur(priceNum, eurToCzkRate),
    domain,
    affiliate_url: affiliateUrl,
    url,
    ean: (candidate.ean ?? "").trim(),
  };
}

function compareOffers(a: BestPurchaseOffer, b: BestPurchaseOffer, sortValue: (o: BestPurchaseOffer) => number): number {
  const diff = sortValue(a) - sortValue(b);
  if (diff !== 0) return diff;
  const aAff = a.affiliate_url ? 0 : 1;
  const bAff = b.affiliate_url ? 0 : 1;
  if (aAff !== bAff) return aAff - bAff;
  return a.domain.localeCompare(b.domain);
}

export function pickBestPurchase(
  candidates: BestPurchaseCandidate[],
  eurToCzkRate: number | null = getEurToCzkRate(),
  identityLevel: IdentityLevel = "name"
): BestPurchase | null {
  let excludedCount = 0;

  // Najlacnejšia platná ponuka za každú doménu
  const bestByDomain = new Map<string, BestPurchaseOffer>();
  for (const candidate of candidates) {
    const offer = toOffer(candidate, eurToCzkRate);
    if (!offer) {
      excludedCount += 1;
      continue;
    }
    const key = offer.domain.toLowerCase();
    const current = bestByDomain.get(key);
    if (!current) {
      bestByDomain.set(key, offer);
      continue;
    }
    if (current.currency_code === offer.currency_code) {
      if (offer.priceNum < current.priceNum) bestByDomain.set(key, offer);
    } else if (current.comparableEur !== null && offer.comparableEur !== null) {
      if (offer.comparableEur < current.comparableEur) bestByDomain.set(key, offer);
    }
    // Rôzne meny bez kurzu v rámci jednej domény — konzervatívne ostáva prvá ponuka
  }

  const allOffers = [...bestByDomain.values()];
  if (allOffers.length === 0) return null;

  const currencies = new Set(allOffers.map((o) => o.currency_code));
  let compared: BestPurchaseOffer[];
  let sortValue: (o: BestPurchaseOffer) => number;
  if (currencies.size <= 1) {
    // Jedna mena — porovnanie priamo v nej, kurz nie je potrebný
    compared = allOffers;
    sortValue = (o) => o.priceNum;
  } else {
    // Mix mien — porovnať možno iba ponuky s normalizovanou EUR hodnotou
    compared = allOffers.filter((o) => o.comparableEur !== null);
    excludedCount += allOffers.length - compared.length;
    sortValue = (o) => o.comparableEur as number;
  }
  if (compared.length === 0) return null;

  const sorted = [...compared].sort((a, b) => compareOffers(a, b, sortValue));
  const lowestOffer = sorted[0];
  const secondOffer = sorted[1] ?? null;
  const priceDifference =
    secondOffer && secondOffer.currency_code === lowestOffer.currency_code
      ? Math.round((secondOffer.priceNum - lowestOffer.priceNum) * 100) / 100
      : null;

  return {
    lowestOffer,
    secondOffer,
    offers: sorted,
    priceDifference,
    offerCount: sorted.length,
    excludedCount,
    isLowestVerified: sorted.length >= 2,
    identityLevel,
  };
}

export interface BestPurchaseCopy {
  /** Nadpis boxu na produktovej stránke. */
  title: string;
  /** Popisok nad cenou odporúčanej ponuky. */
  subtitle: string;
  /** Badge/tvrdenie „NAJNIŽŠIA CENA" je dovolené (len EAN identita). */
  allowLowestBadge: boolean;
  /** Tvrdenie „ušetríš X" je dovolené (len EAN identita). */
  allowSavingsClaim: boolean;
  /** CTA smie tvrdiť „najvýhodnejšia ponuka" (len EAN identita). */
  ctaVerified: boolean;
  /** Povinné upozornenie pri slabšej identite; null pri EAN. */
  disclaimer: string | null;
}

/**
 * UI texty podľa sily identity (PROJECT_VISION §8–9): agresívne tvrdenia
 * („Najvýhodnejšia kúpa", „Najnižšia cena", „Ušetríte") sú dovolené len pri
 * EAN identite s reálne porovnanými ponukami. Pri manufacturer+productno sa
 * hovorí o „rovnakom modeli", pri name fallbacku UI NESMIE tvrdiť, že ide
 * o potvrdený identický produkt.
 */
export function getBestPurchaseCopy(
  best: Pick<BestPurchase, "identityLevel" | "isLowestVerified" | "offerCount">
): BestPurchaseCopy {
  if (!best.isLowestVerified) {
    return {
      title: "Dostupná ponuka",
      subtitle: "Cena",
      allowLowestBadge: false,
      allowSavingsClaim: false,
      ctaVerified: false,
      disclaimer: null,
    };
  }
  switch (best.identityLevel) {
    case "ean":
      return {
        title: "Najvýhodnejšia kúpa",
        subtitle: `Najnižšia cena z ${best.offerCount} porovnaných ponúk`,
        allowLowestBadge: true,
        allowSavingsClaim: true,
        ctaVerified: true,
        disclaimer: null,
      };
    case "manufacturer_productno":
      return {
        title: "Porovnané ponuky rovnakého modelu",
        subtitle: "Cena v odporúčanej ponuke",
        allowLowestBadge: false,
        allowSavingsClaim: false,
        ctaVerified: false,
        disclaimer: "Ponuky sú spárované podľa výrobcu a čísla modelu.",
      };
    case "name":
      return {
        title: "Podobné ponuky z iných obchodov",
        subtitle: "Cena v odporúčanej ponuke",
        allowLowestBadge: false,
        allowSavingsClaim: false,
        ctaVerified: false,
        disclaimer: "Ponuky sú spárované podľa názvu — nemusí ísť o identický produkt.",
      };
  }
}

export interface OtherOffersCopy {
  /** Nadpis sekcie „Ponuky v ďalších obchodoch" na produktovom detaile. */
  title: string;
  /** Disclaimer zobrazený raz nad sekciou; null pri EAN. */
  disclaimer: string | null;
  /** Cenové rozdiely/„najnižšia cena" voči odporúčanej ponuke sú dovolené (len EAN). */
  allowLowestBadge: boolean;
  /** „Ušetríte X" / rozdiel ceny ako dôkaz výhodnosti (len EAN). */
  allowSavingsClaim: boolean;
}

/**
 * Texty sekcie ďalších ponúk podľa sily identity (PROJECT_VISION §8):
 * pri EAN možno hovoriť o rovnakom produkte a ukázať rozdiel ceny; pri
 * manufacturer+productno len „rovnaký model"; pri name fallbacku sa NESMIE
 * tvrdiť identický variant ani používať cenové poradie ako dôkaz.
 */
export function getOtherOffersCopy(identityLevel: IdentityLevel): OtherOffersCopy {
  switch (identityLevel) {
    case "ean":
      return {
        title: "Ponuky rovnakého produktu",
        disclaimer: null,
        allowLowestBadge: true,
        allowSavingsClaim: true,
      };
    case "manufacturer_productno":
      return {
        title: "Ponuky rovnakého modelu",
        disclaimer: "Ponuky sú spárované podľa výrobcu a čísla modelu — nemusí ísť o identický variant.",
        allowLowestBadge: false,
        allowSavingsClaim: false,
      };
    case "name":
      return {
        title: "Podobné ponuky z iných obchodov",
        disclaimer: "Ponuky sú spárované podľa názvu a nemusia predstavovať identický variant.",
        allowLowestBadge: false,
        allowSavingsClaim: false,
      };
  }
}
