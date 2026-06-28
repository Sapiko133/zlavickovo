"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "shop" | "product";

const POPULAR_TAGS = [
  { label: "Alza",      q: "Alza" },
  { label: "Zalando",   q: "Zalando" },
  { label: "iPhone 16", q: "iPhone 16" },
  { label: "Nike",      q: "Nike" },
  { label: "Lidl",      q: "Lidl" },
  { label: "Notino",    q: "Notino" },
];

export default function HeroSearch() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("shop");
  const [q, setQ] = useState("");

  function go(val?: string) {
    const v = (val ?? q).trim();
    if (!v) return;
    router.push("/hladat?q=" + encodeURIComponent(v));
  }

  const placeholder = mode === "shop"
    ? "Napr. Alza, Zalando, Lidl..."
    : "Napr. iPhone 16, Nike tenisky...";

  return (
    <div style={{
      background: "#fff",
      borderBottom: "1px solid #f0f0f0",
      padding: "56px 24px 48px",
      textAlign: "center",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      <div style={{ maxWidth: 660, margin: "0 auto" }}>
        <h1 style={{
          fontSize: "clamp(24px, 4.5vw, 44px)",
          fontWeight: 800, color: "#1d1d1f",
          letterSpacing: "-1px", lineHeight: 1.15,
          margin: "0 0 28px",
        }}>
          Nájdi zľavy pred každým nákupom
        </h1>

        {/* Mode tabs */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 14 }}>
          {([ ["shop", "🏪 Obchod"], ["product", "📦 Produkt"] ] as [Mode, string][]).map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                padding: "8px 22px", borderRadius: 100, fontSize: 13, fontWeight: 600,
                cursor: "pointer", border: "1.5px solid", fontFamily: "inherit",
                transition: "all 0.15s",
                background: mode === m ? "#22C55E" : "#fff",
                color: mode === m ? "#fff" : "#666",
                borderColor: mode === m ? "#22C55E" : "#e0e0e0",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search row */}
        <div style={{ display: "flex", maxWidth: 560, margin: "0 auto" }}>
          <input
            type="text"
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === "Enter" && go()}
            placeholder={placeholder}
            aria-label="Vyhľadávanie"
            style={{
              flex: 1, padding: "14px 20px",
              borderRadius: "12px 0 0 12px",
              border: "2px solid #e0e0e0", borderRight: "none",
              fontSize: 15, color: "#1d1d1f", background: "#f9fafb",
              outline: "none", fontFamily: "inherit",
            }}
            onFocus={e => { e.currentTarget.style.borderColor = "#22C55E"; e.currentTarget.style.background = "#fff"; }}
            onBlur={e => { e.currentTarget.style.borderColor = "#e0e0e0"; e.currentTarget.style.background = "#f9fafb"; }}
          />
          <button
            onClick={() => go()}
            style={{
              padding: "14px 28px", borderRadius: "0 12px 12px 0",
              border: "2px solid #22C55E", background: "#22C55E",
              color: "#fff", fontSize: 15, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
            }}
          >
            Hľadať
          </button>
        </div>

        {/* Popular tags */}
        <div style={{ marginTop: 20, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: "#aaa" }}>Populárne:</span>
          {POPULAR_TAGS.map(tag => (
            <button
              key={tag.label}
              onClick={() => go(tag.q)}
              style={{
                padding: "5px 14px", borderRadius: 100,
                border: "1.5px solid #e8e8e8", background: "#f5f5f7",
                color: "#555", fontSize: 13, fontWeight: 500,
                cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "#22C55E"; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "#22C55E"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#f5f5f7"; e.currentTarget.style.color = "#555"; e.currentTarget.style.borderColor = "#e8e8e8"; }}
            >
              {tag.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
