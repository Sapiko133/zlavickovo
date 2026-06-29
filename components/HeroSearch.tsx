"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import ShopFavicon from "@/components/ShopFavicon";
import { useAutocomplete, PRODUCT_SUGGESTIONS } from "@/hooks/useAutocomplete";

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
  const [mode, setMode]           = useState<Mode>("shop");
  const [q, setQ]                 = useState("");
  const [open, setOpen]           = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);

  const shopSuggestions    = useAutocomplete(q, "shop");
  const productSuggestions = useAutocomplete(q, "product");
  const suggestions        = mode === "shop" ? shopSuggestions : productSuggestions;
  const isShop             = mode === "shop";

  useEffect(() => { setHighlight(-1); }, [q, mode]);
  useEffect(() => {
    if (mode === "shop") setOpen(shopSuggestions.length > 0 && q.length >= 1);
    else setOpen(true);
  }, [shopSuggestions, productSuggestions, mode, q]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const navigateShop = useCallback((slug: string, name: string) => {
    setOpen(false); setQ(name);
    router.push(`/kupony/${slug}`);
  }, [router]);

  const navigateProduct = useCallback((label: string) => {
    setOpen(false); setQ(label);
    router.push("/hladat?q=" + encodeURIComponent(label));
  }, [router]);

  function go() {
    const v = q.trim();
    if (!v) return;
    if (isShop) {
      const first = shopSuggestions[0];
      if (first) { navigateShop(first.slug, first.name); return; }
      router.push(`/kupony/${v.toLowerCase().replace(/\s+/g, "-")}`);
    } else {
      router.push("/hladat?q=" + encodeURIComponent(v));
    }
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      setHighlight(h => (h + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight(h => h <= 0 ? suggestions.length - 1 : h - 1);
    } else if (e.key === "Escape") {
      setOpen(false); setHighlight(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlight >= 0 && suggestions[highlight]) {
        if (isShop) navigateShop(suggestions[highlight].slug, suggestions[highlight].name);
        else navigateProduct(suggestions[highlight].name);
      } else { go(); }
    }
  }

  function handleModeSwitch(m: Mode) {
    setMode(m); setQ(""); setHighlight(-1);
    setOpen(m === "product");
    inputRef.current?.focus();
  }

  function openHeureka() {
    const url = "https://www.heureka.sk/" + (q.trim() ? `?h[frm][q]=${encodeURIComponent(q.trim())}` : "");
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const dropVisible = open && suggestions.length > 0;

  return (
    <div style={{ fontFamily: "system-ui,-apple-system,sans-serif" }}>
      {/* Mode tabs */}
      <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 14 }}>
        {(["shop", "product"] as Mode[]).map(m => (
          <button key={m} onClick={() => handleModeSwitch(m)}
            style={{ padding: "8px 22px", borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "1.5px solid", fontFamily: "inherit", transition: "all .15s", background: mode === m ? "#22C55E" : "#fff", color: mode === m ? "#fff" : "#666", borderColor: mode === m ? "#22C55E" : "#e0e0e0" }}>
            {m === "shop" ? "🏪 Obchod" : "📦 Produkt"}
          </button>
        ))}
      </div>

      {/* Search row + Heureka button */}
      <div ref={containerRef} style={{ position: "relative", maxWidth: 680, margin: "0 auto", display: "flex", gap: 8, alignItems: "flex-start" }}>
        {/* Search box */}
        <div style={{ flex: 1, position: "relative" }}>
          <div style={{ display: "flex", border: `2px solid ${open ? "#22C55E" : "#e0e0e0"}`, borderRadius: 14, background: "#fff", boxShadow: open ? "0 0 0 4px rgba(34,197,94,0.10)" : "0 2px 12px rgba(0,0,0,0.06)", transition: "border-color .15s,box-shadow .15s" }}>
            <input ref={inputRef} type="text" value={q}
              onChange={e => { setQ(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              onKeyDown={handleKeyDown}
              placeholder={isShop ? "Napr. Alza, Zalando, Lidl..." : "Napr. iPhone 16, Nike tenisky..."}
              autoComplete="off"
              style={{ flex: 1, padding: "14px 18px", borderRadius: "12px 0 0 12px", border: "none", background: "transparent", fontSize: 15, color: "#1d1d1f", outline: "none", fontFamily: "inherit" }}
            />
            {q && (
              <button onClick={() => { setQ(""); setOpen(mode === "product"); inputRef.current?.focus(); }} tabIndex={-1}
                style={{ padding: "0 10px", border: "none", background: "transparent", color: "#bbb", cursor: "pointer", fontSize: 18 }}>×</button>
            )}
            <button onClick={go}
              style={{ padding: "14px 24px", borderRadius: "0 12px 12px 0", border: "none", background: "#22C55E", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", transition: "background .15s" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#16A34A")}
              onMouseLeave={e => (e.currentTarget.style.background = "#22C55E")}>
              Hľadať
            </button>
          </div>

          {/* Dropdown */}
          {dropVisible && (
            <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, right: 0, background: "#fff", borderRadius: 12, border: "1px solid #e8e8e8", boxShadow: "0 8px 32px rgba(0,0,0,0.12)", zIndex: 300, overflow: "hidden" }}>
              {suggestions.map((s, i) => (
                <div key={`${s.name}-${i}`}
                  onMouseDown={e => { e.preventDefault(); isShop ? navigateShop(s.slug, s.name) : navigateProduct(s.name); }}
                  onMouseEnter={() => setHighlight(i)}
                  onMouseLeave={() => setHighlight(-1)}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 16px", height: 52, cursor: "pointer", background: highlight === i ? "#F0FDF4" : "#fff", borderBottom: i < suggestions.length - 1 ? "1px solid #f5f5f5" : "none", transition: "background .08s" }}
                >
                  {isShop ? (
                    <ShopFavicon domain={s.domain || ""} name={s.name} size={32} />
                  ) : s.domain ? (
                    <ShopFavicon domain={s.domain} name={s.name} size={32} />
                  ) : (
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>📦</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#1d1d1f", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: "#999", marginTop: 1 }}>
                      {s.price ? <span style={{ color: "#16A34A", fontWeight: 700 }}>{s.price} · </span> : null}
                      {s.category}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: "#bbb", flexShrink: 0 }}>{isShop ? "kupóny →" : "hľadať →"}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Heureka button */}
        <button
          onClick={openHeureka}
          title="Porovnať ceny na Heureka.sk"
          style={{
            padding: "14px 18px", borderRadius: 14, border: "none",
            background: "#FF6600", color: "#fff",
            fontWeight: 700, fontSize: 13, cursor: "pointer",
            fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0,
            boxShadow: "0 4px 14px rgba(255,102,0,0.30)",
            transition: "background .15s, transform .15s",
            lineHeight: 1.3,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "#e55a00"; e.currentTarget.style.transform = "translateY(-1px)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "#FF6600"; e.currentTarget.style.transform = "none"; }}
        >
          🔍 Porovnať<br />na Heureke
        </button>
      </div>

      {/* Popular tags */}
      <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", maxWidth: 680, margin: "16px auto 0" }}>
        <span style={{ fontSize: 13, color: "#aaa", lineHeight: "28px" }}>Populárne:</span>
        {POPULAR_TAGS.map(tag => (
          <button key={tag.label} onClick={() => { setOpen(false); router.push("/hladat?q=" + encodeURIComponent(tag.q)); }}
            style={{ padding: "5px 14px", borderRadius: 100, border: "1.5px solid #e8e8e8", background: "#f5f5f7", color: "#555", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", transition: "all .15s" }}
            onMouseEnter={e => { e.currentTarget.style.background = "#22C55E"; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "#22C55E"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#f5f5f7"; e.currentTarget.style.color = "#555"; e.currentTarget.style.borderColor = "#e8e8e8"; }}>
            {tag.label}
          </button>
        ))}
      </div>
    </div>
  );
}
