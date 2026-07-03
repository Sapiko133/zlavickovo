"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ShopFavicon from "@/components/ShopFavicon";

export interface ShopItem {
  name: string;
  slug: string;
  domain: string;
  count?: number;
  commission?: string;
  logoUrl?: string;
  source: "top" | "dognet" | "ehub" | "cj" | "affial" | "affial-coupon";
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function normalizeLetter(ch: string): string {
  return ch.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
}

function groupByLetter(shops: ShopItem[]): Record<string, ShopItem[]> {
  const map: Record<string, ShopItem[]> = {};
  for (const shop of shops) {
    const raw = shop.name.charAt(0).toUpperCase();
    const letter = normalizeLetter(raw);
    if (!map[letter]) map[letter] = [];
    map[letter].push(shop);
  }
  return map;
}

export default function ObchodyClient({ shops, total }: { shops: ShopItem[]; total: number }) {
  const [query, setQuery] = useState("");
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navRef = useRef<HTMLDivElement>(null);

  const filtered = query
    ? shops.filter(s => s.name.toLowerCase().includes(query.toLowerCase()))
    : shops;

  const grouped = groupByLetter(filtered);
  const availableLetters = new Set(Object.keys(grouped));
  const sortedLetters = LETTERS.filter(l => availableLetters.has(l));

  // For any letters not in A-Z (e.g. from data anomalies) we still include them
  const extraLetters = Object.keys(grouped).filter(l => !LETTERS.includes(l)).sort();
  const allSortedLetters = [...sortedLetters, ...extraLetters];

  const scrollToLetter = useCallback((letter: string) => {
    const el = document.getElementById(`section-${letter}`);
    if (!el) return;
    const navH = 60; // sticky Nav height
    const barH = navRef.current?.offsetHeight ?? 56;
    const top = el.getBoundingClientRect().top + window.scrollY - navH - barH - 8;
    window.scrollTo({ top, behavior: "smooth" });
    setActiveLetter(letter);
  }, []);

  // Track active letter on scroll via IntersectionObserver
  useEffect(() => {
    if (query) return; // don't track while searching
    const observers: IntersectionObserver[] = [];
    for (const letter of allSortedLetters) {
      const el = document.getElementById(`section-${letter}`);
      if (!el) continue;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveLetter(letter); },
        { rootMargin: "-120px 0px -70% 0px", threshold: 0 }
      );
      obs.observe(el);
      observers.push(obs);
    }
    return () => observers.forEach(o => o.disconnect());
  }, [allSortedLetters, query]);

  useEffect(() => { if (query) setActiveLetter(null); }, [query]);

  const showingAll = !query;
  const resultCount = filtered.length;

  return (
    <div style={{ background: "#f8f9fa", minHeight: "100vh" }}>

      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #f0f0f0", padding: "36px 20px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <h1 style={{ fontSize: "clamp(22px,4vw,36px)", fontWeight: 800, margin: "0 0 6px", letterSpacing: "-0.5px" }}>
            🏪 Všetky obchody
          </h1>
          <p style={{ color: "#666", fontSize: 14, margin: "0 0 20px" }}>
            {total}+ obchodov so zľavovými kódmi
          </p>

          {/* Search */}
          <div style={{ display: "flex", maxWidth: 520, border: "2px solid #e0e0e0", borderRadius: 12, background: "#f9fafb", overflow: "hidden", transition: "border-color 0.15s" }}
            onFocus={() => {}} // handled by inner input focus style
          >
            <span style={{ padding: "0 14px", display: "flex", alignItems: "center", color: "#aaa", fontSize: 18 }}>🔍</span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Hľadaj obchod..."
              autoComplete="off"
              style={{
                flex: 1, padding: "12px 0", border: "none", background: "transparent",
                fontSize: 16, color: "#1d1d1f", outline: "none", fontFamily: "inherit",
              }}
            />
            {query && (
              <button onClick={() => { setQuery(""); inputRef.current?.focus(); }}
                style={{ padding: "0 14px", border: "none", background: "transparent", color: "#aaa", cursor: "pointer", fontSize: 18 }}>
                ×
              </button>
            )}
          </div>

          {/* Result count */}
          {query && (
            <p style={{ fontSize: 13, color: "#888", margin: "10px 0 0" }}>
              {resultCount === 0 ? "Žiadne výsledky" : `${resultCount} obchod${resultCount === 1 ? "" : resultCount < 5 ? "y" : "ov"} pre „${query}"`}
            </p>
          )}
        </div>
      </div>

      {/* Letter nav — sticky */}
      <div ref={navRef} style={{
        position: "sticky", top: 60, zIndex: 100,
        background: "#fff", borderBottom: "1px solid #f0f0f0",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      }}>
        <div style={{
          maxWidth: 1200, margin: "0 auto", padding: "10px 20px",
          display: "flex", gap: 2, flexWrap: "wrap",
        }}>
          {LETTERS.map(letter => {
            const has = availableLetters.has(letter);
            const active = activeLetter === letter;
            return (
              <button
                key={letter}
                onClick={() => has && scrollToLetter(letter)}
                disabled={!has}
                style={{
                  minWidth: 34, height: 34, borderRadius: 8, border: "none",
                  background: active ? "#22C55E" : has ? "#f5f5f5" : "transparent",
                  color: active ? "#fff" : has ? "#1d1d1f" : "#d0d0d0",
                  fontWeight: active ? 800 : 600, fontSize: 13, cursor: has ? "pointer" : "default",
                  transition: "background 0.15s, color 0.15s",
                  fontFamily: "inherit",
                }}
                onMouseEnter={e => { if (has && !active) (e.currentTarget as HTMLButtonElement).style.background = "#F0FDF4"; }}
                onMouseLeave={e => { if (has && !active) (e.currentTarget as HTMLButtonElement).style.background = "#f5f5f5"; }}
              >
                {letter}
              </button>
            );
          })}

          {/* Jump to top */}
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            style={{
              marginLeft: "auto", padding: "0 14px", height: 34, borderRadius: 8,
              border: "1px solid #e0e0e0", background: "#fff", color: "#666",
              fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
              fontFamily: "inherit",
            }}
          >
            ↑ Hore
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px 80px" }}>

        {allSortedLetters.length === 0 && (
          <div style={{ textAlign: "center", padding: "80px 24px", color: "#aaa" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
            <p style={{ fontSize: 16 }}>Nenašli sme žiadne obchody pre „{query}"</p>
            <button onClick={() => setQuery("")} style={{ marginTop: 12, padding: "10px 22px", borderRadius: 10, border: "none", background: "#22C55E", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14, fontFamily: "inherit" }}>
              Zobraziť všetky
            </button>
          </div>
        )}

        {allSortedLetters.map(letter => {
          const letterShops = grouped[letter];
          if (!letterShops?.length) return null;
          return (
            <section key={letter} id={`section-${letter}`} style={{ marginBottom: 40, scrollMarginTop: 130 }}>
              {/* Letter heading */}
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12, background: "#22C55E",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontWeight: 900, fontSize: 22, flexShrink: 0,
                }}>
                  {letter}
                </div>
                <div style={{ flex: 1, height: 1, background: "#e8e8e8" }} />
                <span style={{ fontSize: 12, color: "#aaa", fontWeight: 600, whiteSpace: "nowrap" }}>
                  {letterShops.length} obchod{letterShops.length === 1 ? "" : letterShops.length < 5 ? "y" : "ov"}
                </span>
              </div>

              {/* Shop grid */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                gap: 10,
              }}>
                {letterShops.map((shop, i) => (
                  <ShopCard key={`${shop.source}-${shop.slug}-${i}`} shop={shop} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function ShopCard({ shop }: { shop: ShopItem }) {
  const [hovered, setHovered] = useState(false);
  return (
    <a
      href={`/kupony/${shop.slug}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        gap: 8, padding: "16px 10px 14px", borderRadius: 14,
        background: "#fff",
        border: hovered ? "1.5px solid #22C55E" : "1.5px solid #e8e8e8",
        textDecoration: "none", color: "#1d1d1f",
        boxShadow: hovered ? "0 8px 24px rgba(34,197,94,0.12)" : "0 2px 6px rgba(0,0,0,0.04)",
        transform: hovered ? "translateY(-2px)" : "none",
        transition: "border-color 0.15s, box-shadow 0.15s, transform 0.15s",
      }}
    >
      <ShopFavicon domain={shop.domain} name={shop.name} size={44} logoUrl={shop.logoUrl} />
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#1d1d1f", lineHeight: 1.3, wordBreak: "break-word" }}>
          {shop.name}
        </div>
        <div style={{ fontSize: 10, color: "#aaa", marginTop: 3 }}>
          {shop.count != null && shop.count > 0
            ? `${shop.count} kupón${shop.count === 1 ? "" : shop.count < 5 ? "y" : "ov"}`
            : shop.commission
            ? `💰 ${shop.commission}`
            : "kupóny"}
        </div>
      </div>
    </a>
  );
}
