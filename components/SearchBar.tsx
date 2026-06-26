"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const POPULAR_SHOPS = [
  "Alza", "Mall", "Zalando", "Shein", "ASOS", "Zara",
  "Sportisimo", "IKEA", "Notino", "Dedoles", "Martinus", "About You",
];

type SearchMode = "shop" | "product" | "url";

export default function SearchBar() {
  const router = useRouter();
  const [mode, setMode] = useState<SearchMode>("shop");
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const handleInput = (val: string) => {
    setQuery(val);
    if (mode === "shop" && val.length > 0) {
      const filtered = POPULAR_SHOPS.filter(s =>
        s.toLowerCase().startsWith(val.toLowerCase())
      );
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  };

  const handleSearch = (value?: string) => {
    const q = value || query;
    if (!q.trim()) return;
    setSuggestions([]);
    if (mode === "shop") {
      router.push("/kupony/" + q.toLowerCase().replace(/\s+/g, "-"));
    } else if (mode === "product") {
      router.push("/hladat?produkt=" + encodeURIComponent(q));
    } else {
      router.push("/hladat?url=" + encodeURIComponent(q));
    }
  };

  const modes: { key: SearchMode; label: string }[] = [
    { key: "shop", label: "Obchod" },
    { key: "product", label: "Produkt" },
    { key: "url", label: "URL" },
  ];

  const placeholders = {
    shop: "Napr. Alza, Shein, Zalando...",
    product: "Napr. iPhone 15, Nike Air Max...",
    url: "Vlož link produktu...",
  };

  return (
    <div style={{ maxWidth: 620, margin: "0 auto", position: "relative" }}>
      {/* Mode tabs */}
      <div style={{
        display: "inline-flex", background: "rgba(0,0,0,0.05)",
        borderRadius: 12, padding: 4, marginBottom: 12, gap: 2,
      }}>
        {modes.map(m => (
          <button
            key={m.key}
            onClick={() => { setMode(m.key); setQuery(""); setSuggestions([]); }}
            style={{
              padding: "8px 20px", borderRadius: 9, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 500, transition: "all 0.15s",
              background: mode === m.key ? "#fff" : "transparent",
              color: mode === m.key ? "#1d1d1f" : "#888",
              boxShadow: mode === m.key ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Search input */}
      <div style={{ display: "flex", gap: 8, position: "relative" }}>
        <div style={{ flex: 1, position: "relative" }}>
          <input
            type="text"
            value={query}
            onChange={e => handleInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            placeholder={placeholders[mode]}
            style={{
              width: "100%", padding: "16px 20px", borderRadius: 14,
              border: "1.5px solid var(--border)", background: "var(--bg)",
              color: "var(--text)", fontSize: 15, outline: "none",
              boxSizing: "border-box", transition: "border-color 0.15s",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}
            onFocus={e => (e.target.style.borderColor = "#7C3AED")}
            onBlur={e => (e.target.style.borderColor = "#e0e0e0")}
          />

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div style={{
              position: "absolute", top: "calc(100% + 8px)", left: 0, right: 0,
              background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 14,
              overflow: "hidden", zIndex: 100,
              boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
            }}>
              {suggestions.map(s => (
                <div
                  key={s}
                  onClick={() => handleSearch(s)}
                  style={{
                    padding: "12px 20px", cursor: "pointer", fontSize: 14,
                    color: "var(--text)", borderBottom: "1px solid var(--bg2)",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#f5f3ff")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  {s}
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => handleSearch()}
          style={{
            padding: "16px 28px", borderRadius: 14, border: "none",
            background: "linear-gradient(135deg, #7C3AED, #2563EB)",
            color: "#fff", fontWeight: 600, fontSize: 15, cursor: "pointer",
            whiteSpace: "nowrap", boxShadow: "0 4px 16px rgba(124,58,237,0.3)",
          }}
        >
          Hľadať
        </button>
      </div>
    </div>
  );
}
