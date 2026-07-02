"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import ShopFavicon from "@/components/ShopFavicon";
import { useAutocomplete } from "@/hooks/useAutocomplete";

type SearchMode = "shop" | "product";

export default function SearchBar() {
  const router = useRouter();
  const [mode, setMode]           = useState<SearchMode>("shop");
  const [query, setQuery]         = useState("");
  const [open, setOpen]           = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);

  const suggestions = useAutocomplete(query, mode);

  useEffect(() => { setHighlight(-1); }, [suggestions]);
  useEffect(() => { setOpen(suggestions.length > 0); }, [suggestions]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const navigate = useCallback((slug: string, name: string) => {
    setOpen(false); setQuery(name);
    router.push(`/kupony/${slug}`);
  }, [router]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open && e.key !== "Enter") return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight(h => (h + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight(h => h <= 0 ? suggestions.length - 1 : h - 1);
    } else if (e.key === "Escape") {
      setOpen(false); setHighlight(-1);
    } else if (e.key === "Enter") {
      if (highlight >= 0 && suggestions[highlight]) {
        navigate(suggestions[highlight].slug, suggestions[highlight].name);
      } else if (suggestions.length > 0) {
        navigate(suggestions[0].slug, suggestions[0].name);
      } else if (query.trim()) {
        setOpen(false);
        if (mode === "shop") router.push(`/kupony/${query.trim().toLowerCase().replace(/\s+/g, "-")}`);
        else router.push("/hladat?q=" + encodeURIComponent(query.trim()));
      }
    }
  }

  const modes: { key: SearchMode; label: string }[] = [
    { key: "shop",    label: "🏪 Obchod" },
    { key: "product", label: "📦 Produkt" },
  ];

  return (
    <div ref={containerRef} style={{ maxWidth: 640, margin: "0 auto", position: "relative" }}>
      {/* Mode tabs */}
      <div style={{ display: "inline-flex", background: "#f0f0f0", borderRadius: 10, padding: 3, marginBottom: 10, gap: 2 }}>
        {modes.map(m => (
          <button key={m.key}
            onClick={() => { setMode(m.key); setQuery(""); setOpen(false); }}
            style={{ padding: "7px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500, transition: "all .12s", background: mode === m.key ? "#fff" : "transparent", color: mode === m.key ? "#1d1d1f" : "#888", boxShadow: mode === m.key ? "0 1px 3px rgba(0,0,0,0.1)" : "none", fontFamily: "inherit" }}>
            {m.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <div style={{ display: "flex", position: "relative", background: "#fff", borderRadius: 14, border: `2px solid ${open ? "#22C55E" : "#e8e8e8"}`, boxShadow: open ? "0 0 0 4px rgba(34,197,94,0.12)" : "0 2px 12px rgba(0,0,0,0.06)", transition: "border-color .15s,box-shadow .15s", overflow: "visible" }}>
        <input ref={inputRef} type="text" value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder={mode === "shop" ? "Napr. Alza, Shein, Zalando..." : "Napr. iPhone, Nike tenisky..."}
          autoComplete="off"
          style={{ flex: 1, padding: "16px 20px", borderRadius: "12px 0 0 12px", border: "none", background: "transparent", color: "#1d1d1f", fontSize: 16, outline: "none", fontFamily: "inherit" }}
        />
        {query && (
          <button onClick={() => { setQuery(""); setOpen(false); inputRef.current?.focus(); }}
            style={{ padding: "0 10px", border: "none", background: "transparent", color: "#bbb", cursor: "pointer", fontSize: 18, flexShrink: 0 }}
            tabIndex={-1}>×</button>
        )}
        <button
          onClick={() => {
            if (suggestions.length > 0) navigate(suggestions[highlight >= 0 ? highlight : 0].slug, suggestions[highlight >= 0 ? highlight : 0].name);
            else if (query.trim()) {
              if (mode === "shop") router.push(`/kupony/${query.trim().toLowerCase().replace(/\s+/g, "-")}`);
              else router.push("/hladat?q=" + encodeURIComponent(query.trim()));
            }
          }}
          style={{ padding: "16px 28px", borderRadius: "0 12px 12px 0", border: "none", background: "#22C55E", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, fontFamily: "inherit", transition: "background .15s" }}
          onMouseEnter={e => (e.currentTarget.style.background = "#16A34A")}
          onMouseLeave={e => (e.currentTarget.style.background = "#22C55E")}>
          Hľadať
        </button>

        {/* Dropdown */}
        {open && suggestions.length > 0 && (
          <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, right: 0, background: "#fff", border: "1px solid #e8e8e8", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.1)", zIndex: 300, overflow: "hidden" }}>
            {suggestions.map((s, i) => (
              <div key={`${s.slug}-${i}`}
                onMouseDown={e => { e.preventDefault(); navigate(s.slug, s.name); }}
                onMouseEnter={() => setHighlight(i)}
                onMouseLeave={() => setHighlight(-1)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 16px", height: 48, cursor: "pointer", background: highlight === i ? "#F0FDF4" : "#fff", borderBottom: i < suggestions.length - 1 ? "1px solid #f5f5f5" : "none", transition: "background .1s" }}
              >
                <ShopFavicon domain={s.domain || ""} name={s.name} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#1d1d1f", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: "#999", marginTop: 1 }}>{s.category}</div>
                </div>
                <span style={{ fontSize: 12, color: "#bbb", flexShrink: 0 }}>kupóny →</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
