/**
 * Trust-kritická logika pre UI labels ponuky — čistá, testovateľná (žiadne JSX).
 * Rozhoduje, ČI a AKÝ claim sa smie zobraziť. Komponenty len renderujú výsledok.
 *
 * Zásady (audit §4.5/§8, master §8/§10):
 * - Žiadny countdown ani "končí čoskoro" bez známeho dátumu.
 * - "Historicky najnižšia" len s reálnou históriou.
 * - Reálny pozorovaný pokls vs. iba deklarovaná zľava sa OZNAČIA rozdielne.
 * - Nikdy "overené", kým nie je verifikačný event.
 */

import type { DealEvidence } from "@/lib/deals/score";
import { evaluateFreshness, type FreshnessStatus } from "@/lib/offers/freshness";

const DAY_MS = 86_400_000;
const EXPIRING_SOON_DAYS = 3;

export interface ExpiryLabel {
  /** Krátky slovenský text, napr. "Platí do 5. 9." */
  text: string;
  /** Blízka expirácia s dôveryhodným dátumom (amber, nie umelá urgencia). */
  urgent: boolean;
  /** Stav pre farebné rozlíšenie. */
  status: FreshnessStatus;
}

function formatSkDate(iso: string): string {
  return new Intl.DateTimeFormat("sk-SK", {
    day: "numeric",
    month: "numeric",
    timeZone: "Europe/Bratislava",
  }).format(new Date(iso));
}

/**
 * Label platnosti alebo null, keď sa nemá nič tvrdiť. Countdown/"končí čoskoro"
 * vzniká IBA z reálneho dátumu; unknown/no-expiry nevytvára urgenciu.
 */
export function expiryLabel(
  input: { expiresAt?: string | null; startsAt?: string | null },
  now: number = Date.now(),
): ExpiryLabel | null {
  const f = evaluateFreshness(input, now);

  if (f.status === "not_started" && f.startsAt) {
    return { text: `Od ${formatSkDate(f.startsAt)}`, urgent: false, status: f.status };
  }
  if (f.status === "expired") {
    return { text: "Neplatné", urgent: false, status: f.status };
  }
  // active_no_expiry a unknown: žiadny dátum => žiadny countdown, žiadny claim.
  if (f.status !== "active" || !f.expiresAt) {
    return null;
  }

  const daysLeft = (new Date(f.expiresAt).getTime() - now) / DAY_MS;
  const urgent = daysLeft <= EXPIRING_SOON_DAYS;
  return {
    text: urgent ? `Končí ${formatSkDate(f.expiresAt)}` : `Platí do ${formatSkDate(f.expiresAt)}`,
    urgent,
    status: f.status,
  };
}

export type EvidenceTone = "saving" | "historical-low" | "declared" | "coupon";

export interface EvidenceClaim {
  kind: "observed-drop" | "historical-low" | "merchant-discount" | "coupon";
  label: string;
  tone: EvidenceTone;
}

const HISTORY_TRUST_DAYS = 7;

/**
 * Zoznam dôveryhodných dôkazov, ktoré sa smú zobraziť. Reálny pokls a historické
 * minimum len s históriou; deklarovaná zľava sa označí ako "Zľava" (nie "overené")
 * a bez pozorovaného poklesu sa netvári ako reálny pokls.
 */
export function evidenceClaims(evidence: DealEvidence): EvidenceClaim[] {
  const claims: EvidenceClaim[] = [];
  const history = typeof evidence.historyDays === "number" ? evidence.historyDays : 0;

  if (typeof evidence.observedDropPct === "number" && evidence.observedDropPct > 0 && history >= HISTORY_TRUST_DAYS) {
    claims.push({
      kind: "observed-drop",
      label: `−${Math.round(evidence.observedDropPct)} % oproti bežnej cene`,
      tone: "saving",
    });
  }

  if (evidence.atHistoricalLow && history >= HISTORY_TRUST_DAYS) {
    claims.push({ kind: "historical-low", label: "Historicky najnižšia cena", tone: "historical-low" });
  }

  // Deklarovaná zľava sa ukáže len ak nie je zdvojená pozorovaným poklesom.
  const hasObserved = claims.some((c) => c.kind === "observed-drop");
  if (!hasObserved && typeof evidence.merchantDiscountPct === "number" && evidence.merchantDiscountPct > 0) {
    claims.push({
      kind: "merchant-discount",
      label: `Zľava −${Math.round(evidence.merchantDiscountPct)} %`,
      tone: "declared",
    });
  }

  if (evidence.hasCoupon) {
    claims.push({ kind: "coupon", label: "Kupón", tone: "coupon" });
  }

  return claims;
}
