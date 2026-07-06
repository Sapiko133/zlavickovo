"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import ShopFavicon from "@/components/ShopFavicon";
import { useUnifiedAutocomplete } from "@/hooks/useAutocomplete";

const POPULAR = [
  { label: "Alza",      href: "/kupony/alza" },
  { label: "Zalando",   href: "/kupony/zalando" },
  { label: "Shein",     href: "/kupony/shein" },
  { label: "Nike",      href: "/kupony/nike" },
  { label: "Notino",    href: "/kupony/notino" },
  { label: "GymBeam",   href: "/kupony/gymbeam" },
  { label: "Martinus",  href: "/kupony/martinus" },
];

export default function HeroSearch({
  placeholder = "Hľadaj obchod alebo kupón...",
  ctaLabel = "Hľadať",
}: {
  placeholder?: string;
  ctaLabel?: string;
} = {}) {
  const router = useRouter();

  const [query, setQuery]         = useState("");
  const [dropOpen, setDropOpen]   = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [focused, setFocused]     = useState(false);

  const boxRef   = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { results, loading } = useUnifiedAutocomplete(query);

  const flatItems = [
    ...results.products.map(p => ({ type: "product" as const, label: p.name, sub: "Produkt", href: p.url, domain: "" })),
    ...results.shops.map(s => ({ type: "shop" as const, label: s.name, sub: "Obchod", href: `/kupony/${s.slug}`, domain: s.domain })),
    ...results.coupons.map(c => ({ type: "coupon" as const, label: c.title, sub: c.shopName, href: `/kupony/${c.shopSlug}`, domain: "" })),
  ];
  const hasResults = flatItems.length > 0;
  const showEmpty = query.trim().length >= 2 && !loading && !hasResults;

  useEffect(() => { setHighlight(-1); }, [query]);
  useEffect(() => {
    setDropOpen(focused && query.trim().length >= 2 && (hasResults || showEmpty));
  }, [hasResults, showEmpty, focused, query]);

  useEffect(() => {
    if (!dropOpen) return;
    const h = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setDropOpen(false);
        setFocused(false);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [dropOpen]);

  const goItem = useCallback((href: string, label: string) => {
    setDropOpen(false);
    setFocused(false);
    setQuery(label);
    router.push(href);
  }, [router]);

  function submitSearch() {
    if (!query.trim()) return;
    setDropOpen(false);
    router.push("/hladat?q=" + encodeURIComponent(query.trim()));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight(h => (h + 1) % Math.max(flatItems.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight(h => h <= 0 ? flatItems.length - 1 : h - 1);
    } else if (e.key === "Escape") {
      setDropOpen(false); setHighlight(-1); inputRef.current?.blur();
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = highlight >= 0 ? flatItems[highlight] : null;
      if (pick) goItem(pick.href, pick.label);
      else submitSearch();
    }
  }

  return (
    <div style={{ fontFamily: "system-ui,-apple-system,sans-serif" }}>
      <style>{`
        .hero-drop-item { transition:background .08s; }
        .hero-drop-item:hover { background:#F0FDF4 !important; }
      `}</style>
      <div ref={boxRef} style={{ maxWidth: 620, margin: "0 auto", position: "relative" }}>
        <form
          action="/hladat"
          method="get"
          onSubmit={e => { e.preventDefault(); submitSearch(); }}
        >
          <div style={{
            display: "flex", borderRadius: 14, overflow: "hidden",
            border: "2px solid #22C55E",
            boxShadow: "0 4px 20px rgba(34,197,94,0.18)",
            background: "#fff",
          }}>
            <input
              ref={inputRef}
              name="q"
              type="search"
              value={query}
              onChange={e => { setQuery(e.target.value); setDropOpen(true); }}
              onFocus={() => { setFocused(true); if (hasResults) setDropOpen(true); }}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              autoComplete="off"
              style={{
                flex: 1, padding: "16px 20px",
                border: "none", background: "transparent",
                fontSize: 16, color: "#1d1d1f",
                outline: "none",
                fontFamily: "system-ui,-apple-system,sans-serif",
              }}
            />
            <button
              type="submit"
              style={{
                padding: "16px 28px", border: "none",
                background: "#22C55E", color: "#fff",
                fontSize: 15, fontWeight: 700,
                cursor: "pointer",
                fontFamily: "system-ui,-apple-system,sans-serif",
                flexShrink: 0,
                transition: "background .15s",
              }}
            >
              {ctaLabel}
            </button>
          </div>
        </form>

        {/* Dropdown */}
        {dropOpen && (
          <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: "#fff", border: "1px solid #e8e8e8", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.12)", zIndex: 400, overflow: "hidden", textAlign: "left" }}>
            {showEmpty ? (
              <div style={{ padding: "14px 16px", fontSize: 13, color: "#999", textAlign: "center" }}>
                Nenašli sa žiadne výsledky
              </div>
            ) : (
              ([
                { title: "Produkty", start: 0, count: results.products.length },
                { title: "Obchody", start: results.products.length, count: results.shops.length },
                { title: "Kupóny", start: results.products.length + results.shops.length, count: results.coupons.length },
              ] as const).map(sec => sec.count > 0 && (
                <div key={sec.title}>
                  <div style={{ padding: "8px 14px 4px", fontSize: 10, fontWeight: 800, color: "#aaa", letterSpacing: "0.08em", textTransform: "uppercase", background: "#fafafa", borderBottom: "1px solid #f5f5f5" }}>
                    {sec.title}
                  </div>
                  {flatItems.slice(sec.start, sec.start + sec.count).map((item, j) => {
                    const i = sec.start + j;
                    return (
                      <div key={`${item.href}-${i}`}
                        className="hero-drop-item"
                        onMouseDown={e => { e.preventDefault(); goItem(item.href, item.label); }}
                        onMouseEnter={() => setHighlight(i)}
                        onMouseLeave={() => setHighlight(-1)}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", cursor: "pointer", background: highlight === i ? "#F0FDF4" : "#fff", borderBottom: "1px solid #f5f5f5" }}
                      >
                        {item.type === "shop" ? (
                          <ShopFavicon domain={item.domain || ""} name={item.label} size={28} />
                        ) : (
                          <span style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>
                            {item.type === "product" ? "🛍️" : "🎟️"}
                          </span>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: "#1d1d1f", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</div>
                          <div style={{ fontSize: 11, color: "#999", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.sub}</div>
                        </div>
                        <span style={{ fontSize: 11, color: "#ccc", flexShrink: 0 }}>→</span>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div style={{
        marginTop: 14,
        display: "flex", gap: 8, justifyContent: "center",
        flexWrap: "wrap",
      }}>
        <span style={{ fontSize: 13, color: "#999", lineHeight: "30px", flexShrink: 0 }}>
          Populárne:
        </span>
        {POPULAR.map(item => (
          <a
            key={item.href}
            href={item.href}
            style={{
              padding: "5px 14px", borderRadius: 100,
              border: "1.5px solid #e8e8e8",
              background: "#f5f5f7", color: "#555",
              fontSize: 13, fontWeight: 500,
              textDecoration: "none", display: "inline-block",
              lineHeight: "20px",
            }}
          >
            {item.label}
          </a>
        ))}
      </div>
    </div>
  );
}
