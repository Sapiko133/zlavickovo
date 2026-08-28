import { evidenceClaims, type EvidenceTone } from "@/lib/offers/evidence-labels";
import type { DealEvidence } from "@/lib/deals/score";

const TONE_STYLE: Record<EvidenceTone, { color: string; bg: string }> = {
  saving: { color: "var(--color-deal-discount)", bg: "var(--color-deal-discount-bg)" },
  "historical-low": { color: "var(--color-deal-historical-low)", bg: "var(--color-deal-historical-low-bg)" },
  declared: { color: "var(--color-status-unverified)", bg: "var(--color-status-unverified-bg)" },
  coupon: { color: "var(--color-accent-secondary-text)", bg: "var(--color-accent-secondary)" },
};

/**
 * Chipy s dôveryhodnými dôkazmi ceny/zľavy. Zobrazí IBA to, čo dovolia dáta
 * (evidenceClaims); prázdny stav nič nerenderuje.
 */
export default function OfferEvidence({ evidence }: { evidence: DealEvidence }) {
  const claims = evidenceClaims(evidence);
  if (claims.length === 0) return null;

  return (
    <ul
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "var(--space-1)",
        listStyle: "none",
        margin: 0,
        padding: 0,
      }}
    >
      {claims.map((claim) => {
        const tone = TONE_STYLE[claim.tone];
        return (
          <li
            key={claim.kind}
            style={{
              background: tone.bg,
              borderRadius: "var(--deal-badge-radius)",
              color: tone.color,
              fontSize: "var(--font-size-xs)",
              fontWeight: "var(--font-weight-semibold)",
              padding: "var(--deal-badge-padding-block) var(--deal-badge-padding-inline)",
              whiteSpace: "nowrap",
            }}
          >
            {claim.label}
          </li>
        );
      })}
    </ul>
  );
}
