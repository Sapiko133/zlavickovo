"use client";

import { useState } from "react";

const HEUREKA_BASE = "https://www.heureka.sk/?h[frm][q]=";

export default function HeurekaSearch({ shopName }: { shopName?: string }) {
  const [query, setQuery] = useState("");

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    const url = HEUREKA_BASE + encodeURIComponent(q);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div style={{
      background: "var(--card)", borderRadius: 16, border: "1px solid var(--border)",
      padding: "24px 24px 20px", marginTop: 32,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <span style={{ fontSize: 22 }}>🔍</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>
            Nenašiel si čo hľadáš?
          </div>
          <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 1 }}>
            Porovnaj ceny na Heureka.sk{shopName ? ` pre ${shopName}` : ""}
          </div>
        </div>
      </div>

      <form onSubmit={handleSearch} style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Hľadaj produkt na Heureka..."
          style={{
            flex: 1, padding: "10px 14px", borderRadius: 10,
            border: "1.5px solid var(--border)", background: "var(--bg)",
            color: "var(--text)", fontSize: 16, fontFamily: "inherit",
            outline: "none",
          }}
        />
        <button
          type="submit"
          style={{
            padding: "10px 18px", borderRadius: 10, border: "none",
            background: "linear-gradient(135deg, #FF6600, #FF8C00)",
            color: "#fff", fontWeight: 700, fontSize: 13,
            cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit",
            display: "flex", alignItems: "center", gap: 6,
          }}
        >
          Porovnať ceny →
        </button>
      </form>

      <div style={{ marginTop: 10, fontSize: 11, color: "var(--text2)" }}>
        Powered by{" "}
        <a href="https://www.heureka.sk" target="_blank" rel="noopener noreferrer" style={{ color: "#FF6600", textDecoration: "none", fontWeight: 600 }}>
          Heureka.sk
        </a>
        {" "}— porovnávač cien
      </div>
    </div>
  );
}
