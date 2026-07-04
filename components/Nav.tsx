"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ShopFavicon from "@/components/ShopFavicon";
import { useUnifiedAutocomplete } from "@/hooks/useAutocomplete";

const CAT_LIST = [
  { slug: "elektronika", label: "Elektronika", emoji: "💻" },
  { slug: "moda",        label: "Móda",        emoji: "👗" },
  { slug: "zdravie",     label: "Zdravie",     emoji: "💊" },
  { slug: "krasa",       label: "Krása",       emoji: "💄" },
  { slug: "sport",       label: "Šport",       emoji: "⚽" },
  { slug: "byvanie",     label: "Bývanie",     emoji: "🏠" },
  { slug: "potraviny",   label: "Potraviny",   emoji: "🛒" },
  { slug: "deti",        label: "Deti",        emoji: "👶" },
  { slug: "cestovanie",  label: "Cestovanie",  emoji: "✈️" },
  { slug: "knihy",       label: "Knihy",       emoji: "📚" },
];

function CatDropdown({ onClose }: { onClose: () => void }) {
  return (
    <div style={{
      position: "absolute", top: "calc(100% + 8px)", left: "50%",
      transform: "translateX(-50%)", zIndex: 500,
      background: "#fff", border: "1px solid #e8e8e8", borderRadius: 14,
      boxShadow: "0 12px 40px rgba(0,0,0,0.13)", padding: 8, minWidth: 220,
    }}>
      {CAT_LIST.map(c => (
        <a key={c.slug} href={`/kategoria/${c.slug}`} onClick={onClose}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", color: "#222", textDecoration: "none", borderRadius: 8, fontSize: 13, fontWeight: 500 }}
          onMouseEnter={e => (e.currentTarget.style.background = "#F0FDF4")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        >
          <span style={{ fontSize: 18, width: 24, textAlign: "center" }}>{c.emoji}</span>
          {c.label}
        </a>
      ))}
      <div style={{ borderTop: "1px solid #f0f0f0", margin: "6px 0" }} />
      <a href="/kategoria" onClick={onClose}
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", color: "#22C55E", textDecoration: "none", borderRadius: 8, fontSize: 13, fontWeight: 700 }}
        onMouseEnter={e => (e.currentTarget.style.background = "#F0FDF4")}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
      >
        🗂️ Všetky kategórie →
      </a>
    </div>
  );
}

export default function Nav() {
  const router = useRouter();
  const t = useTranslations("nav");

  const NAV_LINKS = [
    { label: t("shops"),   href: "/obchody" },
    { label: t("coupons"), href: "/kupony" },
    { label: t("leaflets"),href: "/akcie" },
    { label: "Letáky",     href: "/letaky" },
  ];

  const [menuOpen, setMenuOpen]   = useState(false);
  const [catOpen, setCatOpen]     = useState(false);
  const [query, setQuery]         = useState("");
  const [dropOpen, setDropOpen]   = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [focused, setFocused]     = useState(false);

  const catRef    = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

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
    if (!catOpen) return;
    const h = (e: MouseEvent) => {
      if (catRef.current && !catRef.current.contains(e.target as Node)) setCatOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [catOpen]);

  useEffect(() => {
    if (!dropOpen) return;
    const h = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setDropOpen(false);
        setFocused(false);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [dropOpen]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  const goItem = useCallback((href: string, label: string) => {
    setDropOpen(false);
    setFocused(false);
    setQuery(label);
    router.push(href);
  }, [router]);

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
      // Bez zvýraznenej položky → fulltext /hladat (rovnako ako HeroSearch)
      const pick = highlight >= 0 ? flatItems[highlight] : null;
      if (pick) { goItem(pick.href, pick.label); }
      else if (query.trim()) {
        setDropOpen(false);
        router.push("/hladat?q=" + encodeURIComponent(query.trim()));
      }
    }
  }

  return (
    <>
      <style>{`
        .nav-link2 { color:#555;text-decoration:none;font-size:13px;font-weight:600;padding:0 2px 2px;border-bottom:2px solid transparent;transition:color .15s,border-color .15s;white-space:nowrap; }
        .nav-link2:hover { color:#22C55E;border-bottom-color:#22C55E; }
        .nav-cat2 { background:none;border:none;cursor:pointer;color:#555;font-size:13px;font-weight:600;padding:0 2px 2px;border-bottom:2px solid transparent;font-family:inherit;transition:color .15s,border-color .15s;display:flex;align-items:center;gap:3px;white-space:nowrap; }
        .nav-cat2:hover,.nav-cat2.open { color:#22C55E;border-bottom-color:#22C55E; }
        .nav-drop-item { transition:background .08s; }
        .nav-drop-item:hover { background:#F0FDF4 !important; }
        @media(max-width:900px){.nav-row2{display:none!important}.nav-hamburger{display:flex!important}.nav-lang-d{display:none!important}}
        @media(min-width:901px){.nav-hamburger{display:none!important}}
      `}</style>

      <nav style={{ position: "sticky", top: 0, zIndex: 300, background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)", fontFamily: "system-ui,-apple-system,sans-serif" }}>

        {/* ── ROW 1: Logo 20% | Search 60% | Lang 20% ── */}
        <div style={{ display: "flex", alignItems: "center", height: 60, padding: "0 20px", gap: 12, borderBottom: "1px solid #f0f0f0" }}>

          {/* Logo */}
          <div style={{ flex: "0 0 20%", minWidth: 140 }}>
            <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: "#22C55E", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 15, fontWeight: 900, flexShrink: 0 }}>Z</div>
              <span style={{ fontWeight: 800, fontSize: 16, color: "#1d1d1f", letterSpacing: "-0.3px", whiteSpace: "nowrap" }}>
                Zlavickovo<span style={{ color: "#22C55E" }}>.sk</span>
              </span>
            </a>
          </div>

          {/* Search — center 60% */}
          <div ref={searchRef} style={{ flex: "1 1 60%", maxWidth: 560, position: "relative" }}>
            <div style={{
              display: "flex", border: `1.5px solid ${focused ? "#22C55E" : "#e0e0e0"}`,
              borderRadius: 10, background: "#f9fafb",
              transition: "border-color .15s,box-shadow .15s",
              boxShadow: focused ? "0 0 0 3px rgba(34,197,94,0.10)" : "none",
            }}>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => { setQuery(e.target.value); setDropOpen(true); }}
                onFocus={() => { setFocused(true); if (hasResults) setDropOpen(true); }}
                onKeyDown={handleKeyDown}
                placeholder={t("search_placeholder")}
                autoComplete="off"
                style={{ flex: 1, padding: "9px 14px", border: "none", background: "transparent", fontSize: 16, color: "#1d1d1f", outline: "none", fontFamily: "inherit" }}
              />
              {query && (
                <button onClick={() => { setQuery(""); setDropOpen(false); inputRef.current?.focus(); }}
                  tabIndex={-1}
                  style={{ padding: "0 8px", border: "none", background: "transparent", color: "#bbb", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>
                  ×
                </button>
              )}
              <button
                onClick={() => {
                  const pick = highlight >= 0 ? flatItems[highlight] : null;
                  if (pick) goItem(pick.href, pick.label);
                  else if (query.trim()) { setDropOpen(false); router.push("/hladat?q=" + encodeURIComponent(query.trim())); }
                }}
                style={{ padding: "8px 16px", border: "none", borderRadius: "0 8px 8px 0", background: "#22C55E", color: "#fff", cursor: "pointer", fontSize: 15, fontWeight: 700, flexShrink: 0, fontFamily: "inherit" }}
                aria-label="Hľadať"
              >🔍</button>
            </div>

            {/* Dropdown */}
            {dropOpen && (
              <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: "#fff", border: "1px solid #e8e8e8", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.12)", zIndex: 400, overflow: "hidden" }}>
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
                            className="nav-drop-item"
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

          {/* Right — 20% */}
          <div style={{ flex: "0 0 20%", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>
            <span className="nav-lang-d"><LanguageSwitcher /></span>
            <button className="nav-hamburger"
              onClick={() => setMenuOpen(o => !o)}
              aria-label={menuOpen ? "Zavrieť" : "Menu"}
              style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#1d1d1f", padding: 6, minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}>
              {menuOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>

        {/* ── ROW 2: Nav links (desktop only) ── */}
        <div className="nav-row2" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 32, height: 38, padding: "0 20px" }}>
          {NAV_LINKS.map(l => (
            <a key={l.href} href={l.href} className="nav-link2">{l.label}</a>
          ))}
          <div ref={catRef} style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <button className={`nav-cat2${catOpen ? " open" : ""}`} onClick={() => setCatOpen(o => !o)} aria-expanded={catOpen}>
              Kategórie <span style={{ fontSize: 10, opacity: 0.7 }}>{catOpen ? "▲" : "▼"}</span>
            </button>
            {catOpen && <CatDropdown onClose={() => setCatOpen(false)} />}
          </div>
        </div>
      </nav>

      {/* ── Mobile fullscreen menu ── */}
      {menuOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "#fff", overflowY: "auto", display: "flex", flexDirection: "column", fontFamily: "system-ui,-apple-system,sans-serif" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", height: 60, flexShrink: 0, borderBottom: "1px solid #f0f0f0", position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>
            <a href="/" onClick={() => setMenuOpen(false)} style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: "#22C55E", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 15, fontWeight: 900 }}>Z</div>
              <span style={{ fontWeight: 800, fontSize: 16, color: "#1d1d1f" }}>Zlavickovo<span style={{ color: "#22C55E" }}>.sk</span></span>
            </a>
            <button onClick={() => setMenuOpen(false)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#1d1d1f", padding: 6, minWidth: 44, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          </div>
          {NAV_LINKS.map(l => (
            <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)}
              style={{ display: "flex", alignItems: "center", padding: "0 20px", minHeight: 52, color: "#1d1d1f", textDecoration: "none", fontSize: 16, fontWeight: 600, borderBottom: "1px solid #f5f5f5" }}>
              {l.label}
            </a>
          ))}
          <div style={{ padding: "14px 20px 6px", fontSize: 11, fontWeight: 700, color: "#aaa", letterSpacing: "0.08em", textTransform: "uppercase" }}>Kategórie</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
            {CAT_LIST.map(c => (
              <a key={c.slug} href={`/kategoria/${c.slug}`} onClick={() => setMenuOpen(false)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 20px", minHeight: 48, color: "#444", textDecoration: "none", fontSize: 14, fontWeight: 500, borderBottom: "1px solid #f5f5f5" }}>
                <span style={{ fontSize: 20 }}>{c.emoji}</span> {c.label}
              </a>
            ))}
          </div>
          <div style={{ padding: "16px 20px" }}><LanguageSwitcher /></div>
        </div>
      )}
    </>
  );
}
