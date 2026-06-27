"use client";

import { useState, useEffect } from "react";

const LANGS = [
  { code: "sk", label: "SK", flag: "🇸🇰" },
  { code: "cs", label: "CZ", flag: "🇨🇿" },
  { code: "en", label: "EN", flag: "🇬🇧" },
];

function getCookieLocale(): string {
  if (typeof document === "undefined") return "sk";
  const m = document.cookie.match(/(?:^|; )NEXT_LOCALE=([^;]*)/);
  return m ? decodeURIComponent(m[1]) : "sk";
}

export default function LanguageSwitcher() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("sk");

  useEffect(() => { setCurrent(getCookieLocale()); }, []);

  function switchLang(code: string) {
    document.cookie = `NEXT_LOCALE=${code}; path=/; max-age=31536000`;
    setOpen(false);
    window.location.reload();
  }

  const active = LANGS.find(l => l.code === current) ?? LANGS[0];

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 4,
          background: "none", border: "1px solid #e0e0e0", borderRadius: 8,
          padding: "5px 10px", cursor: "pointer", fontSize: 12,
          fontWeight: 600, color: "#555", fontFamily: "inherit",
        }}
      >
        {active.flag} {active.label} ▾
      </button>

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 998 }}
          />
          <div style={{
            position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 999,
            background: "#fff", border: "1px solid #e0e0e0", borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,0.1)", overflow: "hidden", minWidth: 110,
          }}>
            {LANGS.map(l => (
              <button
                key={l.code}
                onClick={() => switchLang(l.code)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  width: "100%", padding: "10px 14px", background: l.code === current ? "#f5f3ff" : "none",
                  border: "none", cursor: "pointer", fontSize: 13,
                  fontWeight: l.code === current ? 700 : 400,
                  color: l.code === current ? "#7C3AED" : "#444",
                  fontFamily: "inherit", textAlign: "left",
                }}
              >
                <span>{l.flag}</span>
                <span>{l.label}</span>
                {l.code === current && <span style={{ marginLeft: "auto", fontSize: 11 }}>✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
