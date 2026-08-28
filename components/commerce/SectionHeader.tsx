import type { ReactNode } from "react";

/**
 * Nadpis sekcie deal/coupon listingu. Sémantické <h2>, crawlable "zobraziť viac".
 */
export default function SectionHeader({
  title,
  subtitle,
  href,
  linkLabel = "Zobraziť všetko",
  icon,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  linkLabel?: string;
  icon?: ReactNode;
}) {
  return (
    <div
      style={{
        alignItems: "baseline",
        display: "flex",
        flexWrap: "wrap",
        gap: "var(--space-2) var(--space-4)",
        justifyContent: "space-between",
        marginBottom: "var(--space-4)",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <h2
          style={{
            alignItems: "center",
            color: "var(--color-text-primary)",
            display: "flex",
            fontFamily: "var(--font-family-display)",
            fontSize: "var(--section-title-size)",
            fontWeight: "var(--font-weight-extrabold)",
            gap: "var(--space-2)",
            letterSpacing: "var(--letter-spacing-tight)",
            lineHeight: "var(--line-height-tight)",
            margin: 0,
          }}
        >
          {icon}
          {title}
        </h2>
        {subtitle ? (
          <p
            style={{
              color: "var(--color-text-secondary)",
              fontSize: "var(--font-size-sm)",
              lineHeight: "var(--line-height-snug)",
              margin: "var(--space-1) 0 0",
            }}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
      {href ? (
        <a
          href={href}
          style={{
            color: "var(--color-text-link)",
            fontSize: "var(--font-size-sm)",
            fontWeight: "var(--font-weight-semibold)",
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          {linkLabel} →
        </a>
      ) : null}
    </div>
  );
}
