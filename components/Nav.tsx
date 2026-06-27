"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useRouter } from "next/navigation";

function NavSearch() {
  const t = useTranslations("nav");
  const router = useRouter();
  const [q, setQ] = useState("");

  function go() {
    const v = q.trim();
    if (!v) return;
    router.push("/hladat?q=" + encodeURIComponent(v));
  }

  return (
    <div style={{ display: "flex", flex: 1, maxWidth: 460 }}>
      <input
        type="text"
        value={q}
        onChange={e => setQ(e.target.value)}
        onKeyDown={e => e.key === "Enter" && go()}
        placeholder={t("search_placeholder")}
        style={{
          flex: 1, padding: "9px 16px", borderRadius: "8px 0 0 8px",
          border: "1.5px solid #e0e0e0", borderRight: "none",
          background: "#f7f7f7", color: "#1d1d1f", fontSize: 14,
          outline: "none", fontFamily: "inherit",
        }}
        onFocus={e => { e.target.style.borderColor = "#22C55E"; e.target.style.background = "#fff"; }}
        onBlur={e => { e.target.style.borderColor = "#e0e0e0"; e.target.style.background = "#f7f7f7"; }}
      />
      <button
        onClick={go}
        aria-label="Search"
        style={{
          padding: "9px 14px", borderRadius: "0 8px 8px 0",
          border: "1.5px solid #22C55E", background: "#22C55E",
          color: "#fff", cursor: "pointer", fontSize: 15, flexShrink: 0,
        }}
      >
        🔍
      </button>
    </div>
  );
}

export default function Nav() {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);

  const NAV_LINKS = [
    { label: t("coupons"),    href: "/#zlavy" },
    { label: t("shops"),      href: "/obchody" },
    { label: t("leaflets"),   href: "/letaky" },
    { label: t("cashback"),   href: "/cashback" },
    { label: t("categories"), href: "/obchody" },
  ];

  return (
    <>
      <style>{`
        @media(max-width:900px){
          .nav-top { padding: 0 16px !important; gap: 8px !important; }
          .nav-search-wrap { display: none !important; }
          .nav-sub { display: none !important; }
          .nav-mobile-btn { display: flex !important; }
          .nav-right-desktop { display: none !important; }
        }
        .nav-sub-link { color:#444; text-decoration:none; font-size:13px; font-weight:500; padding:10px 0; white-space:nowrap; border-bottom:2px solid transparent; transition:color 0.15s, border-color 0.15s; }
        .nav-sub-link:hover { color:#22C55E; border-bottom-color:#22C55E; }
        .nav-fav-link { display:flex; align-items:center; gap:5px; color:#555; text-decoration:none; font-size:13px; font-weight:500; transition:color 0.15s; }
        .nav-fav-link:hover { color:#22C55E; }
      `}</style>

      {/* Top row */}
      <div className="nav-top" style={{
        display: "flex", alignItems: "center", gap: 16,
        padding: "0 32px", height: 58,
        background: "#fff", borderBottom: "1px solid #f0f0f0",
        position: "sticky", top: 0, zIndex: 200,
      }}>
        {/* Logo */}
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", flexShrink: 0 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "#22C55E", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 15, fontWeight: 900 }}>Z</div>
          <span style={{ fontWeight: 800, fontSize: 16, color: "#1d1d1f", letterSpacing: "-0.3px" }}>
            Zlavickovo<span style={{ color: "#22C55E" }}>.sk</span>
          </span>
        </a>

        {/* Center search */}
        <div className="nav-search-wrap" style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <NavSearch />
        </div>

        {/* Right */}
        <div className="nav-right-desktop" style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
          <a href="/oblibene" className="nav-fav-link">
            <span style={{ fontSize: 16 }}>♡</span> {t("favorites")}
          </a>
          <LanguageSwitcher />
        </div>

        {/* Mobile: lang + hamburger */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <div className="nav-right-desktop" style={{ display: "none" }} />
          <LanguageSwitcher />
          <button
            className="nav-mobile-btn"
            onClick={() => setOpen(o => !o)}
            aria-label="Menu"
            style={{ display: "none", background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#1d1d1f", padding: "4px 6px" }}
          >
            {open ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* Bottom sub-nav */}
      <div className="nav-sub" style={{
        background: "#fff", borderBottom: "1px solid #f0f0f0",
        position: "sticky", top: 58, zIndex: 199,
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 32px", display: "flex", gap: 28 }}>
          {NAV_LINKS.map(l => (
            <a key={l.href + l.label} href={l.href} className="nav-sub-link">{l.label}</a>
          ))}
        </div>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div style={{
          position: "fixed", top: 58, left: 0, right: 0, zIndex: 198,
          background: "#fff", borderBottom: "1px solid #e8e8e8",
          boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
        }}>
          <div style={{ padding: "12px 16px 8px" }}>
            <NavSearch />
          </div>
          {NAV_LINKS.map(l => (
            <a key={l.href + l.label} href={l.href} onClick={() => setOpen(false)}
              style={{ display: "block", padding: "13px 20px", color: "#1d1d1f", textDecoration: "none", fontSize: 15, fontWeight: 500, borderBottom: "1px solid #f5f5f5" }}>
              {l.label}
            </a>
          ))}
        </div>
      )}
    </>
  );
}
