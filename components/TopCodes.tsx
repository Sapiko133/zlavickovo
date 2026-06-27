"use client";

import { useState, useEffect } from "react";

type TopCode = { code: string; shop: string; discount: string; clicks: number; slug: string };

const COLORS = ["#E8001D","#0065BD","#00A551","#FF6900","#22C55E","#003580","#D32F2F"];
function shopColor(name: string) { return COLORS[name.charCodeAt(0) % COLORS.length]; }

export default function TopCodes({ shopFilter, limit = 6, title = "🔥 Trending kódy" }: {
  shopFilter?: string;
  limit?: number;
  title?: string;
}) {
  const [codes, setCodes] = useState<TopCode[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const url = shopFilter
      ? `/api/top-codes?shop=${encodeURIComponent(shopFilter.toLowerCase())}`
      : "/api/top-codes";
    fetch(url).then(r => r.json()).then(data => setCodes(Array.isArray(data) ? data.slice(0, limit) : [])).catch(() => {});
  }, [shopFilter, limit]);

  function trackAndCopy(code: string, shop: string) {
    fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, shop }) }).catch(() => {});
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  }

  if (!codes.length) return null;

  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 700, color: "#1d1d1f", marginBottom: 14 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {codes.map((item, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
            background: "#fff", border: "1px solid #f0f0f0", borderRadius: 10,
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8, background: shopColor(item.shop), flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontWeight: 800, fontSize: 12,
            }}>
              {item.shop.charAt(0)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "monospace", fontWeight: 800, fontSize: 13, color: "#22C55E", letterSpacing: 1 }}>
                {item.code}
              </div>
              <div style={{ fontSize: 11, color: "#aaa" }}>
                {item.shop}{item.discount ? ` · ${item.discount}` : ""}
              </div>
            </div>
            {item.discount && (
              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: "#F0FDF4", color: "#22C55E", flexShrink: 0 }}>
                {item.discount}
              </span>
            )}
            {item.clicks > 0 && (
              <span style={{ fontSize: 11, color: "#aaa", flexShrink: 0 }}>👥 {item.clicks}x</span>
            )}
            <button
              onClick={() => trackAndCopy(item.code, item.shop)}
              style={{
                padding: "6px 10px", borderRadius: 7, border: "none", flexShrink: 0,
                background: copied === item.code ? "#16a34a" : "#22C55E",
                color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer",
              }}
            >
              {copied === item.code ? "✓" : "Kopírovať"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
