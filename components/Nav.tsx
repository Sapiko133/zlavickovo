"use client";

import { useState, useRef, useEffect } from "react";
import LanguageSwitcher from "@/components/LanguageSwitcher";

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

const NAV_LINKS = [
  { label: "Obchody", href: "/obchody" },
  { label: "Kupóny",  href: "/kupony" },
  { label: "Akcie",   href: "/akcie" },
  { label: "Letáky",  href: "/letaky" },
];

function CatDropdown({ onClose }: { onClose: () => void }) {
  return (
    <div style={{
      position: "absolute", top: "calc(100% + 10px)", left: "50%",
      transform: "translateX(-50%)", zIndex: 500,
      background: "#fff", border: "1px solid #e8e8e8", borderRadius: 14,
      boxShadow: "0 12px 40px rgba(0,0,0,0.12)", padding: "8px", minWidth: 220,
    }}>
      {CAT_LIST.map(c => (
        <a
          key={c.slug}
          href={`/kategoria/${c.slug}`}
          onClick={onClose}
          style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "9px 12px", color: "#222", textDecoration: "none",
            borderRadius: 8, fontSize: 13, fontWeight: 500,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "#F0FDF4")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        >
          <span style={{ fontSize: 18, width: 24, textAlign: "center" }}>{c.emoji}</span>
          {c.label}
        </a>
      ))}
      <div style={{ borderTop: "1px solid #f0f0f0", margin: "6px 0" }} />
      <a
        href="/kategoria"
        onClick={onClose}
        style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "9px 12px", color: "#22C55E", textDecoration: "none",
          borderRadius: 8, fontSize: 13, fontWeight: 700,
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "#F0FDF4")}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
      >
        🗂️ Všetky kategórie →
      </a>
    </div>
  );
}

export default function Nav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const catRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!catOpen) return;
    function handler(e: MouseEvent) {
      if (catRef.current && !catRef.current.contains(e.target as Node)) {
        setCatOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [catOpen]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  return (
    <>
      <style>{`
        .nav-link {
          color: #444; text-decoration: none; font-size: 14px; font-weight: 500;
          padding: 4px 0; white-space: nowrap; border-bottom: 2px solid transparent;
          transition: color 0.15s, border-color 0.15s;
        }
        .nav-link:hover { color: #22C55E; border-bottom-color: #22C55E; }
        .nav-cat-btn {
          background: none; border: none; cursor: pointer; color: #444;
          font-size: 14px; font-weight: 500; padding: 4px 0; white-space: nowrap;
          border-bottom: 2px solid transparent; font-family: inherit;
          transition: color 0.15s, border-color 0.15s;
          display: flex; align-items: center; gap: 4px; line-height: 1;
        }
        .nav-cat-btn:hover, .nav-cat-btn.open { color: #22C55E; border-bottom-color: #22C55E; }
        @media(max-width: 768px) {
          .nav-links-desktop { display: none !important; }
          .nav-hamburger { display: flex !important; }
        }
      `}</style>

      <nav style={{
        display: "flex", alignItems: "center", gap: 0,
        padding: "0 24px", height: 60,
        background: "#fff", borderBottom: "1px solid #f0f0f0",
        position: "sticky", top: 0, zIndex: 300,
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}>
        {/* Logo */}
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", flexShrink: 0, marginRight: 32 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "#22C55E", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 15, fontWeight: 900 }}>Z</div>
          <span style={{ fontWeight: 800, fontSize: 16, color: "#1d1d1f", letterSpacing: "-0.3px" }}>
            Zlavickovo<span style={{ color: "#22C55E" }}>.sk</span>
          </span>
        </a>

        {/* Desktop nav links */}
        <div className="nav-links-desktop" style={{ display: "flex", alignItems: "center", gap: 28, flex: 1 }}>
          {NAV_LINKS.map(l => (
            <a key={l.href} href={l.href} className="nav-link">{l.label}</a>
          ))}

          {/* Kategórie dropdown */}
          <div ref={catRef} style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <button
              className={`nav-cat-btn${catOpen ? " open" : ""}`}
              onClick={() => setCatOpen(o => !o)}
              aria-expanded={catOpen}
            >
              Kategórie <span style={{ fontSize: 10, opacity: 0.7 }}>{catOpen ? "▲" : "▼"}</span>
            </button>
            {catOpen && <CatDropdown onClose={() => setCatOpen(false)} />}
          </div>
        </div>

        {/* Right: language switcher + hamburger */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
          <LanguageSwitcher />
          <button
            className="nav-hamburger"
            onClick={() => setMenuOpen(o => !o)}
            aria-label={menuOpen ? "Zavrieť menu" : "Otvoriť menu"}
            aria-expanded={menuOpen}
            style={{
              display: "none", background: "none", border: "none",
              fontSize: 22, cursor: "pointer", color: "#1d1d1f",
              padding: "6px", lineHeight: 1, minWidth: 44, minHeight: 44,
              alignItems: "center", justifyContent: "center",
            }}
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>
      </nav>

      {/* Mobile fullscreen menu */}
      {menuOpen && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 500,
          background: "#fff", overflowY: "auto",
          display: "flex", flexDirection: "column",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "0 16px", height: 60, flexShrink: 0,
            borderBottom: "1px solid #f0f0f0",
            position: "sticky", top: 0, background: "#fff", zIndex: 1,
          }}>
            <a href="/" onClick={() => setMenuOpen(false)} style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: "#22C55E", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 15, fontWeight: 900 }}>Z</div>
              <span style={{ fontWeight: 800, fontSize: 16, color: "#1d1d1f" }}>Zlavickovo<span style={{ color: "#22C55E" }}>.sk</span></span>
            </a>
            <button
              onClick={() => setMenuOpen(false)}
              aria-label="Zavrieť menu"
              style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#1d1d1f", padding: "6px", minWidth: 44, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              ✕
            </button>
          </div>

          {NAV_LINKS.map(l => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setMenuOpen(false)}
              style={{
                display: "flex", alignItems: "center", padding: "0 20px", minHeight: 52,
                color: "#1d1d1f", textDecoration: "none",
                fontSize: 16, fontWeight: 600, borderBottom: "1px solid #f5f5f5",
              }}
            >
              {l.label}
            </a>
          ))}

          <div style={{ padding: "16px 20px 8px", fontSize: 11, fontWeight: 700, color: "#aaa", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Kategórie
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
            {CAT_LIST.map(c => (
              <a
                key={c.slug}
                href={`/kategoria/${c.slug}`}
                onClick={() => setMenuOpen(false)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "0 20px", minHeight: 48, color: "#444",
                  textDecoration: "none", fontSize: 14, fontWeight: 500,
                  borderBottom: "1px solid #f5f5f5",
                }}
              >
                <span style={{ fontSize: 20 }}>{c.emoji}</span> {c.label}
              </a>
            ))}
          </div>

          <div style={{ padding: "16px 20px" }}>
            <LanguageSwitcher />
          </div>
        </div>
      )}
    </>
  );
}
