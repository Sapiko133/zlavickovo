import type { CSSProperties } from "react";
import type { FeedProviderHealth, HealthMetric, HealthStatus } from "@/lib/feeds/health";
import ProviderRefreshButton from "./ProviderRefreshButton";

const STATUS_COPY: Record<HealthStatus, { label: string; color: string; bg: string; border: string }> = {
  healthy: { label: "Zdravé", color: "#166534", bg: "#f0fdf4", border: "#bbf7d0" },
  warning: { label: "Pozor", color: "#92400e", bg: "#fffbeb", border: "#fde68a" },
  missing: { label: "Chýbajú dáta", color: "#9a3412", bg: "#fff7ed", border: "#fed7aa" },
  error: { label: "Chyba", color: "#991b1b", bg: "#fef2f2", border: "#fecaca" },
  unsupported: { label: "Nepodporované", color: "#475569", bg: "#f1f5f9", border: "#cbd5e1" },
};

const METRIC_COPY: Record<HealthMetric["status"], string> = {
  ok: "Dostupné",
  empty: "Prázdne",
  missing: "Cache chýba",
  error: "Chyba čítania",
  unsupported: "Nepodporované",
  static: "Manuálna evidencia",
};

function formatCount(metric: HealthMetric): string {
  if (metric.status === "unsupported") return "—";
  if (metric.count === null) return "Neznáme";
  return new Intl.NumberFormat("sk-SK").format(metric.count);
}

function formatDate(value: string | null): string {
  if (!value) return "Nikdy / neznáme";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Neznáme";
  return new Intl.DateTimeFormat("sk-SK", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Bratislava",
  }).format(date);
}

function formatTtl(seconds: number | null): string {
  if (seconds === null) return "—";
  if (seconds < 60) return `${seconds} s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`;
}

function Metric({ label, metric }: { label: string; metric: HealthMetric }) {
  const isProblem = metric.status === "missing" || metric.status === "error";
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ color: "#64748b", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ color: isProblem ? "#b91c1c" : "#0f172a", fontSize: 21, fontWeight: 800, lineHeight: 1.2, marginTop: 4 }}>
        {formatCount(metric)}
      </div>
      <div title={metric.detail} style={{ color: isProblem ? "#b91c1c" : "#64748b", fontSize: 11, marginTop: 3 }}>
        {METRIC_COPY[metric.status]}
      </div>
    </div>
  );
}

export default function ProviderHealthCard({ provider }: { provider: FeedProviderHealth }) {
  const status = STATUS_COPY[provider.status];
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

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(2, minmax(0, 1fr))", padding: 16 }}>
        <Metric label="Produkty" metric={provider.products} />
        <Metric label="Kupóny" metric={provider.coupons} />
      </div>

      <dl style={{ background: "#f8fafc", borderTop: "1px solid #f1f5f9", display: "grid", gap: "7px 12px", gridTemplateColumns: "minmax(0, 1fr) auto", margin: 0, padding: "12px 16px" }}>
        <dt style={{ color: "#64748b", fontSize: 11 }}>Feedy konfigurácia / cache</dt>
        <dd style={{ color: "#334155", fontSize: 11, fontWeight: 700, margin: 0 }}>
          {provider.configuredFeeds ?? "?"} / {provider.cachedFeeds ?? "?"}
        </dd>
        <dt style={{ color: "#64748b", fontSize: 11 }}>Chýbajúce cache kľúče</dt>
        <dd style={{ color: provider.missingFeeds ? "#b45309" : "#334155", fontSize: 11, fontWeight: 700, margin: 0 }}>
          {provider.missingFeeds ?? "?"}
        </dd>
        <dt style={{ color: "#64748b", fontSize: 11 }}>Najkratšie TTL</dt>
        <dd style={{ color: "#334155", fontSize: 11, fontWeight: 700, margin: 0 }}>{formatTtl(provider.cacheTtlSeconds)}</dd>
        <dt style={{ color: "#64748b", fontSize: 11 }}>Posledný import</dt>
        <dd style={{ color: "#334155", fontSize: 11, fontWeight: 700, margin: 0, textAlign: "right" }}>{formatDate(provider.lastImportAt)}</dd>
      </dl>

      <div style={{ borderTop: "1px solid #f1f5f9", color: provider.status === "error" ? "#991b1b" : "#475569", fontSize: 12, lineHeight: 1.5, padding: "12px 16px" }}>
        {provider.message}
        {provider.error ? (
          <details style={{ marginTop: 7 }}>
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>Technický detail</summary>
            <code style={{ display: "block", fontSize: 11, marginTop: 5, overflowWrap: "anywhere" }}>{provider.error}</code>
          </details>
        ) : null}
      </div>

      <div style={{ borderTop: "1px solid #f1f5f9", padding: "12px 16px" }}>
        <ProviderRefreshButton provider={provider.id} />
      </div>
    </article>
  );
}

