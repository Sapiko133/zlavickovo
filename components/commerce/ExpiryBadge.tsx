import { expiryLabel } from "@/lib/offers/evidence-labels";

/**
 * Pill s platnosťou ponuky. Amber IBA pri dôveryhodnej blízkej expirácii —
 * žiadna umelá urgencia, žiadny badge bez známeho dátumu.
 */
export default function ExpiryBadge({
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

  const isExpired = label.status === "expired";
  const color = isExpired
    ? "var(--color-status-error)"
    : label.urgent
      ? "var(--color-deal-expiring)"
      : "var(--color-text-secondary)";
  const bg = isExpired
    ? "var(--color-status-error-bg)"
    : label.urgent
      ? "var(--color-deal-expiring-bg)"
      : "var(--color-bg-tertiary)";

  return (
    <span
      style={{
        alignItems: "center",
        background: bg,
        borderRadius: "var(--deal-badge-radius)",
        color,
        display: "inline-flex",
        fontSize: "var(--font-size-xs)",
        fontWeight: "var(--font-weight-semibold)",
        gap: "var(--space-1)",
        padding: "var(--deal-badge-padding-block) var(--deal-badge-padding-inline)",
        whiteSpace: "nowrap",
      }}
    >
      {label.text}
    </span>
  );
}
