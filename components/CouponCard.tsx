"use client";

import RevealCode from "@/components/RevealCode";

const COLORS = ["#E8001D", "#0065BD", "#00A551", "#FF6900", "#7B2FBE", "#003580", "#D32F2F", "#FF4081", "#006A35", "#8B1A1A"];

const TYPE_LABELS: Record<number, string> = {
  1: "Zľava", 2: "Darček", 3: "Výpredaj", 4: "Iné", 5: "Doprava zadarmo",
};

const SOURCE_BADGES: Record<string, { label: string; bg: string; color: string }> = {
  dognet: { label: "Overený", bg: "#dcfce7", color: "#16a34a" },
  affial: { label: "Affial",  bg: "#dbeafe", color: "#1d4ed8" },
  ai:     { label: "AI",      bg: "#ede9fe", color: "#7C3AED" },
};

export default function CouponCard({ coupon, token }: { coupon: any; token?: string | null }) {
  const storeName = coupon.campaign?.name || coupon.campaign_name || "Obchod";
  const logoColor = COLORS[storeName.charCodeAt(0) % COLORS.length];
  const link = coupon.affiliate_link || coupon.url || "#";
  const expires = coupon.valid_to
    ? new Date(coupon.valid_to).toLocaleDateString("sk-SK")
    : null;

  return (
    <div style={{
      background: "#fff", borderRadius: 14,
      boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
      border: "1px solid #eee",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{ padding: "16px 20px 12px", display: "flex", alignItems: "center", gap: 14, borderBottom: "1px solid #f0f0f0" }}>
        <div style={{
          width: 48, height: 48, borderRadius: 10, background: logoColor, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontWeight: 800, fontSize: 18,
        }}>
          {storeName.charAt(0)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#1a1a2e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {storeName}
          </div>
          {expires && <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>Vyprší: {expires}</div>}
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {coupon.source && SOURCE_BADGES[coupon.source] && (
            <div style={{ background: SOURCE_BADGES[coupon.source].bg, color: SOURCE_BADGES[coupon.source].color, fontWeight: 700, fontSize: 10, padding: "4px 8px", borderRadius: 8 }}>
              {SOURCE_BADGES[coupon.source].label}
            </div>
          )}
          <div style={{ background: "#fff0f0", color: "#E8001D", fontWeight: 700, fontSize: 11, padding: "4px 10px", borderRadius: 8 }}>
            {TYPE_LABELS[coupon.type] || "Akcia"}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "14px 20px", flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: "#1a1a2e", lineHeight: 1.4 }}>
          {coupon.title || coupon.name}
        </div>
        {coupon.description && (
          <div style={{ fontSize: 13, color: "#666", marginTop: 6, lineHeight: 1.5 }}>
            {coupon.description.length > 100 ? coupon.description.slice(0, 100) + "..." : coupon.description}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: "12px 20px 16px", borderTop: "1px dashed #eee" }}>
        {token ? (
          <div>
            <RevealCode token={token} />
            <a href={link} target="_blank" rel="noopener noreferrer"
              style={{ display: "block", textAlign: "center", marginTop: 8, fontSize: 13, color: "#7C3AED", fontWeight: 600, textDecoration: "none" }}>
              Prejsť do obchodu →
            </a>
          </div>
        ) : (
          <a href={link} target="_blank" rel="noopener noreferrer"
            style={{ display: "block", padding: 11, borderRadius: 9, background: "#1a1a2e", color: "#fff", fontWeight: 700, fontSize: 14, textAlign: "center", textDecoration: "none" }}>
            Prejsť na akciu →
          </a>
        )}
      </div>
    </div>
  );
}
