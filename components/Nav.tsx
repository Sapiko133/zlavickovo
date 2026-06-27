"use client";

import { useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageSwitcher from "@/components/LanguageSwitcher";

function NotifButton() {
  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
  if (!appId) return null;

  function handleClick() {
    import("react-onesignal")
      .then(({ default: OneSignal }) => {
        (OneSignal.Slidedown as any).promptPush().catch(() => {});
      })
      .catch(() => {});
  }

  return (
    <button
      onClick={handleClick}
      title="Dostávať upozornenia"
      style={{
        background: "none", border: "1px solid var(--border)", borderRadius: 8,
        padding: "5px 10px", cursor: "pointer", fontSize: 15,
        color: "var(--nav-text)", display: "flex", alignItems: "center", gap: 4,
      }}
    >
      🔔
    </button>
  );
}

interface NavLink { label: string; href: string; }

const LINKS: NavLink[] = [
  { label: "Obchody", href: "/obchody" },
  { label: "🛒 Potraviny", href: "/letaky" },
  { label: "Cashback", href: "/cashback" },
  { label: "Blog", href: "/blog" },
];

export default function Nav() {
  const links = LINKS;
  const [open, setOpen] = useState(false);

  return (
    <>
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 48px", height: 56, position: "sticky", top: 0, zIndex: 200,
        background: "var(--nav-bg)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid var(--nav-border)",
      }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "var(--text)" }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #7C3AED, #2563EB)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, fontWeight: 800 }}>Z</div>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Zlavickovo</span>
        </a>

        <div className="nav-desktop" style={{ display: "flex", gap: 20, fontSize: 13, alignItems: "center" }}>
          {links.map(l => (
            <a key={l.href + l.label} href={l.href} style={{ color: "var(--nav-text)", textDecoration: "none" }}>{l.label}</a>
          ))}
          <LanguageSwitcher />
          <NotifButton />
          <ThemeToggle />
        </div>

        <button
          className="nav-mobile-btn"
          onClick={() => setOpen(o => !o)}
          aria-label="Menu"
          style={{ display: "none", background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "var(--text)", padding: "4px 8px" }}
        >
          {open ? "✕" : "☰"}
        </button>
      </nav>

      {open && (
        <div
          className="nav-mobile-dropdown"
          style={{
            position: "fixed", top: 56, left: 0, right: 0, zIndex: 199,
            background: "var(--bg)", borderBottom: "1px solid var(--border)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
            display: "none", flexDirection: "column",
          }}
        >
          {links.map(l => (
            <a
              key={l.href + l.label}
              href={l.href}
              onClick={() => setOpen(false)}
              style={{ padding: "14px 24px", color: "var(--text)", textDecoration: "none", fontSize: 15, fontWeight: 500, borderBottom: "1px solid var(--border)" }}
            >
              {l.label}
            </a>
          ))}
          <div style={{ padding: "12px 24px", display: "flex", gap: 12, borderBottom: "1px solid var(--border)" }}>
            <LanguageSwitcher />
            <NotifButton />
            <ThemeToggle />
          </div>
        </div>
      )}

      <style>{`
        @media(max-width:768px){
          nav { padding: 0 16px !important; }
          .nav-desktop { display: none !important; }
          .nav-mobile-btn { display: flex !important; align-items: center; }
          .nav-mobile-dropdown { display: flex !important; }
        }
      `}</style>
    </>
  );
}
