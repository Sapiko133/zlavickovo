"use client";

import { useState } from "react";

export default function CouponCard({ coupon }: { coupon: any }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const storeName = coupon.campaign?.name || "Obchod";
  const colors = ["#E8001D", "#0065BD", "#00A551", "#FF6900", "#7B2FBE", "#003580"];
  const logoColor = colors[storeName.charCodeAt(0) % colors.length];
  const code = coupon.code || null;
  const link = coupon.affiliate_link || coupon.url || "#";
  const expires = coupon.valid_to
    ? new Date(coupon.valid_to).toLocaleDateString("sk-SK")
    : null;

  const TYPE_LABELS: Record<number, string> = {
    1: "Zľava", 2: "Darček", 3: "Výpredaj", 4: "Iné", 5: "Doprava zadarmo",
  };

  return (
    <div style={{
      background: "#fff",
      borderRadius: 14,
      boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
      border: "1px solid #eee",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{ padding: "16px 20px 12px", display: "flex", alignItems: "center", gap: 14, borderBottom: "1px solid #f0f0f0" }}>
        <div style={{
          width: 48, height: 48, borderRadius: 10, background: logoColor,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontWeight: 800, fontSize: 18, flexShrink: 0,
        }}>
          {storeName.charAt(0)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#1a1a2e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {storeName}
          </div>
          {expires && <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>Vyprší: {expires}</div>}
        </div>
        <div style={{ background: "#fff0f0", color: "#E8001D", fontWeight: 700, fontSize: 11, padding: "4px 10px", borderRadius: 8 }}>
          {TYPE_LABELS[coupon.type] || "Akcia"}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "14px 20px", flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: "#1a1a2e", lineHeight: 1.4 }}>
          {coupon.title || coupon.name}
        </div>
        {coupon.description && (
          <div style={{ fontSize: 13, color: "#666", marginTop: 6, lineHeight: 1.5 }}>
            {coupon.description.length > 100
              ? coupon.description.slice(0, 100) + "..."
              : coupon.description}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: "12px 20px 16px", borderTop: "1px dashed #eee" }}>
        {code ? (
          !revealed ? (
            <button
              onClick={() => setRevealed(true)}
              style={{ width: "100%", padding: 11, borderRadius: 9, background: "#E8001D", color: "#fff", border: "none", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
            >
              🎁 Zobraziť kód
            </button>
          ) : (
            <div>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1, padding: "10px 14px", background: "#f7f7f7", borderRadius: 8, border: "2px dashed #E8001D", fontWeight: 800, fontSize: 14, color: "#E8001D", letterSpacing: 2, textAlign: "center" }}>
                  {code}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(code).catch(() => {});
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  style={{ padding: "10px 14px", borderRadius: 8, background: copied ? "#00A551" : "#1a1a2e", color: "#fff", border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                >
                  {copied ? "✓" : "Kopírovať"}
                </button>
              </div>
              <a href={link} target="_blank" rel="noopener noreferrer"
                style={{ display: "block", textAlign: "center", marginTop: 8, fontSize: 13, color: "#E8001D", fontWeight: 600, textDecoration: "none" }}>
                Prejsť do obchodu →
              </a>
            </div>
          )
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