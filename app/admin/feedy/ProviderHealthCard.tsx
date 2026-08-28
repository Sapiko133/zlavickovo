import type { CSSProperties } from "react";
import type { FeedProviderHealth, HealthStatus, MetricStatus } from "@/lib/feeds/health";

const STATUS_COPY: Record<HealthStatus, { label: string; color: string; bg: string; border: string }> = {
  healthy: { label: "Zdravé", color: "#166534", bg: "#f0fdf4", border: "#bbf7d0" },
  warning: { label: "Pozor", color: "#92400e", bg: "#fffbeb", border: "#fde68a" },
  missing: { label: "Chýbajú dáta", color: "#9a3412", bg: "#fff7ed", border: "#fed7aa" },
  error: { label: "Chyba", color: "#991b1b", bg: "#fef2f2", border: "#fecaca" },
};

const METRIC_COPY: Record<MetricStatus, string> = {
  ok: "Dostupné z cache",
  empty: "Prázdne",
  missing: "Cache chýba",
  error: "Chyba čítania",
  static: "Manuálna evidencia",
};

function formatTtl(seconds: number | null): string {
  if (seconds === null) return "—";
  if (seconds < 60) return `${seconds} s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`;
}

export default function ProviderHealthCard({ provider }: { provider: FeedProviderHealth }) {
  const status = STATUS_COPY[provider.status];
  const count = provider.coupons.count;
  const isProblem = provider.coupons.status === "missing" || provider.coupons.status === "error";
  const cardStyle: CSSProperties = {
    background: "#ffffff",
    border: `1px solid ${provider.status === "healthy" ? "#e2e8f0" : status.border}`,
    borderRadius: 14,
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    overflow: "hidden",
  };

  return (
    <article style={cardStyle} aria-label={`${provider.label}: ${status.label}`}>
      <div style={{ alignItems: "center", borderBottom: "1px solid #f1f5f9", display: "flex", gap: 12, padding: "15px 16px" }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ color: "#0f172a", fontSize: 16, fontWeight: 800, margin: 0 }}>{provider.label}</h2>
          <div style={{ color: "#64748b", fontSize: 11, marginTop: 3 }}>
            {provider.configured ? "Nakonfigurované" : "Chýba konfigurácia"}
          </div>
        </div>
        <span style={{ background: status.bg, border: `1px solid ${status.border}`, borderRadius: 999, color: status.color, fontSize: 11, fontWeight: 800, marginLeft: "auto", padding: "4px 9px", whiteSpace: "nowrap" }}>
          {status.label}
        </span>
      </div>

      <div style={{ display: "flex", gap: 24, padding: 16 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: "#64748b", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            Kupóny / akcie
          </div>
          <div style={{ color: isProblem ? "#b91c1c" : "#0f172a", fontSize: 24, fontWeight: 800, lineHeight: 1.2, marginTop: 4 }}>
            {count === null ? "Neznáme" : new Intl.NumberFormat("sk-SK").format(count)}
          </div>
          <div title={provider.coupons.detail} style={{ color: isProblem ? "#b91c1c" : "#64748b", fontSize: 11, marginTop: 3 }}>
            {METRIC_COPY[provider.coupons.status]}
          </div>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: "#64748b", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            Cache TTL
          </div>
          <div style={{ color: "#0f172a", fontSize: 24, fontWeight: 800, lineHeight: 1.2, marginTop: 4 }}>
            {formatTtl(provider.cacheTtlSeconds)}
          </div>
        </div>
      </div>

      <div style={{ borderTop: "1px solid #f1f5f9", color: provider.status === "error" ? "#991b1b" : "#475569", fontSize: 12, lineHeight: 1.5, padding: "12px 16px" }}>
        {provider.message}
        {provider.error ? (
          <details style={{ marginTop: 7 }}>
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>Technický detail</summary>
            <code style={{ display: "block", fontSize: 11, marginTop: 5, overflowWrap: "anywhere" }}>{provider.error}</code>
          </details>
        ) : null}
      </div>
    </article>
  );
}
