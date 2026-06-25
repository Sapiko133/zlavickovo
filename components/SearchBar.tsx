"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const POPULAR_SHOPS = [
  "Alza", "Mall", "Zalando", "Shein", "ASOS", "Zara", "H&M",
  "Sportisimo", "IKEA", "Notino", "Dedoles", "Martinus",
  "Dr. Max", "Lidl", "Kaufland", "About You", "Answear",
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
      router.push(`/kupony/${q.toLowerCase().replace(/\s+/g, "-")}`);
    } else if (mode === "product") {
      router.push(`/hladat?produkt=${encodeURIComponent(q)}`);
    } else if (mode === "url") {
      router.push(`/hladat?url=${encodeURIComponent(q)}`);
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", position: "relative" }}>
      {/* Prepínač módov */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, justifyContent: "center" }}>
        {(["shop", "product", "url"] as SearchMode[]).map(m => (
          <button
            key={m}
            onClick={() => { setMode(m); setQuery(""); setSuggestions([]); }}
            style={{
              padding: "6px 16px",
              borderRadius: 20,
              border: "none",
              cursor: "pointer",
              fontWeight: mode === m ? 700 : 400,
              background: mode === m ? "#fff" : "rgba(255,255,255,0.2)",
              color: mode === m ? "#E8001D" : "#fff",
              fontSize: 14,
            }}
          >
            {m === "shop" ? "🏪 Obchod" : m === "product" ? "📦 Produkt" : "🔗 URL"}
          </button>
        ))}
      </div>

      {/* Input */}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          value={query}
          onChange={e => handleInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSearch()}
          placeholder={
            mode === "shop" ? "Napr. Alza, Shein, Zalando..." :
            mode === "product" ? "Napr. iPhone 15, Nike Air Max..." :
            "Vlož link produktu..."
          }
          style={{
            flex: 1,
            padding: "14px 20px",
            borderRadius: 12,
            border: "none",
            fontSize: 16,
            outline: "none",
          }}
        />
        <button
          onClick={() => handleSearch()}
          style={{
            padding: "14px 24px",
            borderRadius: 12,
            background: "#E8001D",
            color: "#fff",
            border: "none",
            fontWeight: 700,
            fontSize: 16,
            cursor: "pointer",
          }}
        >
          Hľadať
        </button>
      </div>

      {/* Suggestions dropdown */}
      {suggestions.length > 0 && (
        <div style={{
          position: "absolute",
          top: "100%",
          left: 0,
          right: 60,
          background: "#fff",
          borderRadius: 12,
          boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
          zIndex: 100,
          marginTop: 4,
          overflow: "hidden",
        }}>
          {suggestions.map(s => (
            <div
              key={s}
              onClick={() => handleSearch(s)}
              style={{
                padding: "12px 20px",
                cursor: "pointer",
                fontSize: 15,
                color: "#1a1a2e",
                borderBottom: "1px solid #f0f0f0",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "#fff0f0")}
              onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
            >
              🏪 {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}