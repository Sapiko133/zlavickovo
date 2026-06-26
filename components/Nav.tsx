"use client";

import { useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";

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
        background: "none", border: "1px solid #e0e0e0", borderRadius: 8,
        padding: "5px 10px", cursor: "pointer", fontSize: 15,
        color: "#555", display: "flex", alignItems: "center", gap: 4,
      }}
    >
      🔔
    </button>
  );
}

interface NavLink { label: string; href: string }

const DEFAULT_LINKS: NavLink[] = [
  { label: "Obchody", href: "/obchody" },
  { label: "Letáky", href: "/letaky" },
  { label: "Cashback", href: "/cashback" },
  { label: "Blog", href: "/blog" },
  { label: "Všetky obchody", href: "/obchody" },
];

export default function Nav({ links = DEFAULT_LINKS }: { links?: NavLink[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 48px", height: 56, position: "sticky", top: 0, zIndex: 200,
        background: "rgba(255,255,255,0.9)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(0,0,0,0.08)",
      }}>
        {/* Logo */}
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "#1d1d1f" }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #7C3AED, #2563EB)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, fontWeight: 800 }}>Z</div>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Zlavickovo</span>
        </a>

        {/* Desktop links */}
        <div className="nav-desktop" style={{ display: "flex", gap: 20, fontSize: 13, alignItems: "center" }}>
          {links.map(l => (
            <a key={l.href + l.label} href={l.href} style={{ color: "#555", textDecoration: "none" }}>{l.label}</a>
          ))}
          <NotifButton />
          <ThemeToggle />
        </div>

        {/* Mobile hamburger */}
        <button
          className="nav-mobile-btn"
          onClick={() => setOpen(o => !o)}
          aria-label="Menu"
          style={{ display: "none", background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#1d1d1f", padding: "4px 8px" }}
        >
          {open ? "✕" : "☰"}
        </button>
      </nav>

      {/* Mobile dropdown */}
      {open && (
        <div
          className="nav-mobile-dropdown"
          style={{
            position: "fixed", top: 56, left: 0, right: 0, zIndex: 199,
            background: "#fff", borderBottom: "1px solid #e5e7eb",
            boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
            display: "none",
            flexDirection: "column",
          }}
        >
          {links.map(l => (
            <a
              key={l.href + l.label}
              href={l.href}
              onClick={() => setOpen(false)}
              style={{ padding: "14px 24px", color: "#1d1d1f", textDecoration: "none", fontSize: 15, fontWeight: 500, borderBottom: "1px solid #f5f5f5" }}
            >
              {l.label}
            </a>
          ))}
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
