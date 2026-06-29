"use client";

import React, { useState } from "react";

interface Props {
  code: any;
  shopName: string;
  type: "promo" | "deal";
}

export default function AiCouponCard({ code, shopName, type }: Props) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const link = code.url;
  const codeStr = code.code && code.code !== "AKCIA" ? code.code : null;

  function handleShowCode(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (link) window.open(link, "_blank", "noopener,noreferrer");
    setRevealed(true);
    if (codeStr) {
      navigator.clipboard.writeText(codeStr).catch(() => {});
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeStr, shop: shopName }),
      }).catch(() => {});
    }
  }

  function copyCode() {
    if (!codeStr) return;
    navigator.clipboard.writeText(codeStr).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #eaecf0", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      <div style={{ padding: "14px 18px 10px", borderBottom: "1px solid #f5f5f5" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: "#1d1d1f", flex: 1, marginRight: 8, lineHeight: 1.3 }}>
            {code.discount || code.description || "Špeciálna zľava"}
          </span>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "3px 7px", borderRadius: 5, flexShrink: 0,
            background: type === "promo" ? "#ede9fe" : "#f0fdf4",
            color: type === "promo" ? "#7C3AED" : "#16a34a",
          }}>
            {type === "promo" ? "Promo kód" : "Akcia"}
          </span>
        </div>
        {code.description && type === "promo" && (
          <div style={{ fontSize: 12, color: "#666", lineHeight: 1.5 }}>{code.description}</div>
        )}
        {code.valid_until && (
          <div style={{ fontSize: 11, color: "#aaa", marginTop: 4 }}>Vyprší: {code.valid_until}</div>
        )}
      </div>
      <div style={{ padding: "12px 18px 14px" }}>
        {type === "promo" ? (
          revealed ? (
            <div>
              {codeStr && (
                <div
                  onClick={copyCode}
                  title="Kliknúť pre kopírovanie"
                  style={{
                    fontFamily: "monospace", fontWeight: 800, fontSize: 14, color: "#7C3AED",
                    background: "#f5f3ff", border: "2px dashed #7C3AED", borderRadius: 8,
                    padding: "8px 12px", letterSpacing: 2, textAlign: "center",
                    cursor: "pointer", marginBottom: 8,
                  }}
                >
                  {codeStr}
                </div>
              )}
              {codeStr && (
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
              )}
            </div>
          ) : (
            <button
              onClick={handleShowCode}
              style={{
                width: "100%", padding: "10px", borderRadius: 9, border: "none",
                background: "linear-gradient(135deg, #7C3AED, #2563EB)",
                color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer",
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
              display: "block", padding: "10px", borderRadius: 9,
              background: "#1d1d1f", color: "#fff", fontWeight: 700,
              fontSize: 13, textAlign: "center", textDecoration: "none",
            }}
          >
            Prejsť na akciu →
          </a>
        )}
      </div>
    </div>
  );
}
