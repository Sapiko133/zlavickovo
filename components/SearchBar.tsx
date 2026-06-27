"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const POPULAR_SHOPS = [
  "Alza", "Mall", "Zalando", "Shein", "ASOS", "Zara",
  "Sportisimo", "IKEA", "Notino", "Dedoles", "Martinus", "About You",
];

type SearchMode = "shop" | "url";

export default function SearchBar() {
  const router = useRouter();
  const [mode, setMode] = useState<SearchMode>("shop");
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const handleInput = (val: string) => {
    setQuery(val);
    if (mode === "shop" && val.length > 0) {
      setSuggestions(POPULAR_SHOPS.filter(s => s.toLowerCase().startsWith(val.toLowerCase())));
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
    } else {
      router.push("/hladat?q=" + encodeURIComponent(q));
    }
  };

  const modes: { key: SearchMode; label: string }[] = [
    { key: "shop", label: "🏪 Obchod" },
    { key: "url",  label: "🔗 URL" },
  ];

  const placeholders: Record<SearchMode, string> = {
    shop: "Napr. Alza, Shein, Zalando...",
    url:  "Vlož link produktu alebo obchodu...",
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", position: "relative" }}>
      <div style={{ display: "inline-flex", background: "#f0f0f0", borderRadius: 10, padding: 3, marginBottom: 10, gap: 2 }}>
        {modes.map(m => (
          <button
            key={m.key}
            onClick={() => { setMode(m.key); setQuery(""); setSuggestions([]); }}
            style={{
              padding: "7px 18px", borderRadius: 8, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 500, transition: "all 0.12s",
              background: mode === m.key ? "#fff" : "transparent",
              color: mode === m.key ? "#1d1d1f" : "#888",
              boxShadow: mode === m.key ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 0, position: "relative", background: "#fff", borderRadius: 14, border: "2px solid #e8e8e8", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", overflow: "visible" }}>
        <div style={{ flex: 1, position: "relative" }}>
          <input
            type="text"
            value={query}
            onChange={e => handleInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            placeholder={placeholders[mode]}
            style={{
              width: "100%", padding: "16px 20px", borderRadius: "12px 0 0 12px",
              border: "none", background: "transparent",
              color: "#1d1d1f", fontSize: 15, outline: "none",
              boxSizing: "border-box",
            }}
          />
          {suggestions.length > 0 && (
            <div style={{
              position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
              background: "#fff", border: "1px solid #e8e8e8", borderRadius: 12,
              overflow: "hidden", zIndex: 100,
              boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
            }}>
              {suggestions.map(s => (
                <div
                  key={s}
                  onClick={() => handleSearch(s)}
                  style={{ padding: "11px 20px", cursor: "pointer", fontSize: 14, color: "#1d1d1f", borderBottom: "1px solid #f5f5f5" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#F0FDF4")}
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
            padding: "16px 28px", borderRadius: "0 12px 12px 0", border: "none",
            background: "#22C55E", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer",
            whiteSpace: "nowrap", flexShrink: 0,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "#16A34A")}
          onMouseLeave={e => (e.currentTarget.style.background = "#22C55E")}
        >
          Hľadať
        </button>
      </div>
    </div>
  );
}
