import { expiryLabel } from "@/lib/offers/evidence-labels";

/**
 * Nenápadný textový stav platnosti (napr. pod shop action kartou). Bez dátumu
 * nezobrazí nič — nevytvára falošnú urgenciu ani countdown.
 */
export default function FreshnessState({
  expiresAt,
  startsAt,
  now,
}: {
  expiresAt?: string | null;
  startsAt?: string | null;
  now?: number;
}) {
  const label = expiryLabel({ expiresAt, startsAt }, now);
  if (!label) return null;

  const color =
    label.status === "expired"
      ? "var(--color-status-error)"
      : label.urgent
        ? "var(--color-deal-expiring)"
        : "var(--color-text-tertiary)";

  return (
    <span style={{ color, fontSize: "var(--font-size-xs)", fontWeight: "var(--font-weight-medium)" }}>
      {label.text}
    </span>
  );
}
