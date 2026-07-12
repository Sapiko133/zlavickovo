import { T } from "@/lib/design-tokens";
import type { ProductPriceStats } from "@/lib/heureka/price-history";
import { getFormattedProductPrices, getPreferredDisplayCurrency } from "@/lib/price";

interface ProductPriceHistoryProps {
  stats: ProductPriceStats | null;
  domain: string;
}

/**
 * Produktový detail V1 — Cenová história (90 dní).
 * Renderuje LEN aktuálnu cenu, 90-dňové minimum, maximum a pokles od maxima.
 * Graf a priebeh cien (points[]) sú odložené do V2.
 * Zobrazí sa iba ak existuje štatistika (≥2 snapshoty) — inak vráti null.
 */
export default function ProductPriceHistory({ stats, domain }: ProductPriceHistoryProps) {
  if (!stats) return null;

  const displayCurrency = getPreferredDisplayCurrency(domain, stats.currency);
  const fmt = (amount: number) =>
    getFormattedProductPrices(amount, stats.currency, undefined, displayCurrency)?.primary ?? "";

  const current = fmt(stats.current);
  const min = fmt(stats.min);
  const max = fmt(stats.max);
  const hasDrop = stats.dropFromMaxPct > 0;

  return (
    <div
      style={{
        background: T.white,
        border: `1.5px solid ${T.border}`,
        borderRadius: 14,
        padding: "16px 20px",
        marginBottom: 24,
        maxWidth: 560,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: T.textPrimary }}>
          📊 Cenová história (90 dní)
        </div>
        {hasDrop && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: T.white,
              background: T.green,
              padding: "3px 10px",
              borderRadius: T.rFull,
            }}
          >
            −{stats.dropFromMaxPct}% od maxima
          </span>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        <div style={{ background: T.bgAlt, borderRadius: 10, padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, marginBottom: 4 }}>Aktuálna</div>
          <div style={{ fontSize: 15, color: T.textPrimary, fontWeight: 900 }}>{current}</div>
        </div>
        <div style={{ background: T.bgAlt, borderRadius: 10, padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, marginBottom: 4 }}>Min. za 90 dní</div>
          <div style={{ fontSize: 15, color: T.greenDark, fontWeight: 900 }}>{min}</div>
        </div>
        <div style={{ background: T.bgAlt, borderRadius: 10, padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, marginBottom: 4 }}>Max. za 90 dní</div>
          <div style={{ fontSize: 15, color: T.textPrimary, fontWeight: 900 }}>{max}</div>
        </div>
      </div>

      <div style={{ fontSize: 11, color: T.textFaint, marginTop: 10 }}>
        Z cien zaznamenaných pri denných importoch. Orientačné, nemusí zahŕňať každú zmenu.
      </div>
    </div>
  );
}
