"use client";

import { useState } from "react";

const COLORS = ["#E8001D","#0065BD","#00A551","#FF6900","#7B2FBE","#003580","#D32F2F","#FF4081","#006A35","#8B1A1A"];
const TYPE_LABELS: Record<number, string> = {
  1: "Zľava", 2: "Darček", 3: "Výpredaj", 4: "Iné", 5: "Doprava zadarmo",
};

function decodeCode(token: string): string {
  try {
    const d = atob(token);
    return d.slice(d.indexOf(":") + 1);
  } catch {
    return "";
  }
}

export default function CouponCard({ coupon, token, sponsored }: { coupon: any; token?: string | null; sponsored?: boolean }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const storeName = coupon.campaign?.name || coupon.campaign_name || "Obchod";
  const logoColor = COLORS[storeName.charCodeAt(0) % COLORS.length];
  const link = coupon.affiliate_link || coupon.url;
  const code = token ? decodeCode(token) : null;
  const expires = coupon.valid_to ? new Date(coupon.valid_to).toLocaleDateString("sk-SK") : null;

  function handleShowCode() {
    if (link) window.open(link, "_blank", "noopener,noreferrer");
    setRevealed(true);
    if (code) {
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, shop: storeName }),
      }).catch(() => {});
    }
  }

  function copyCode() {
    if (!code) return;
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{
      background: "#fff", borderRadius: 14, border: "1px solid #e8e8e8",
      boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{ padding: "16px 20px 12px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid #f5f5f5" }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: logoColor, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 18 }}>
          {storeName.charAt(0)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#1d1d1f", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {storeName}
          </div>
          {expires && <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>do {expires}</div>}
        </div>
        {sponsored ? (
          <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 7px", borderRadius: 6, background: "#fff7ed", color: "#ea580c", flexShrink: 0 }}>
            Sponzorované
          </span>
        ) : (
          <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 7px", borderRadius: 6, background: "#dcfce7", color: "#16a34a", flexShrink: 0 }}>
            ✓ Overený
          </span>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: "14px 20px", flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#475569", background: "#f1f5f9", display: "inline-block", padding: "2px 8px", borderRadius: 5, marginBottom: 8 }}>
          {TYPE_LABELS[coupon.type] || "Akcia"}
        </div>
        <div style={{ fontWeight: 600, fontSize: 14, color: "#1d1d1f", lineHeight: 1.4, marginBottom: 6 }}>
          {coupon.title || coupon.name}
        </div>
        {coupon.description && (
          <div style={{ fontSize: 13, color: "#666", lineHeight: 1.5 }}>
            {coupon.description.length > 90 ? coupon.description.slice(0, 90) + "..." : coupon.description}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: "12px 20px 16px", borderTop: "1px dashed #f0f0f0" }}>
        {token ? (
          revealed ? (
            <div>
              <div
                onClick={copyCode}
                title="Kliknúť pre kopírovanie"
                style={{
                  fontFamily: "monospace", fontWeight: 800, fontSize: 15, color: "#7C3AED",
                  background: "#f5f3ff", border: "2px dashed #7C3AED", borderRadius: 8,
                  padding: "9px 12px", letterSpacing: 2, textAlign: "center",
                  cursor: "pointer", marginBottom: 8,
                }}
              >
                {code}
              </div>
              <button
                onClick={copyCode}
                style={{
                  width: "100%", padding: "8px", borderRadius: 8, border: "1px solid #e0e0e0",
                  background: copied ? "#16a34a" : "#fff", color: copied ? "#fff" : "#444",
                  fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                }}
              >
                {copied ? "✓ Skopírované" : "Kopírovať"}
              </button>
            </div>
          ) : (
            <button
              onClick={handleShowCode}
              style={{
                width: "100%", padding: "11px", borderRadius: 10, border: "none",
                background: "linear-gradient(135deg, #7C3AED, #2563EB)",
                color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              🎁 Zobraziť kód
            </button>
          )
        ) : (
          <a
            href={link || "#"}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "block", padding: "11px", borderRadius: 10,
              background: "linear-gradient(135deg, #7C3AED, #2563EB)",
              color: "#fff", fontWeight: 700, fontSize: 14, textAlign: "center", textDecoration: "none",
            }}
          >
            Prejsť na akciu →
          </a>
        )}
      </div>
    </div>
  );
}
