"use client";

import { useState, useEffect } from "react";

export default function InstallBanner() {
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("pwa-banner-dismissed")) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const timer = setTimeout(() => setShow(true), 30000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      clearTimeout(timer);
    };
  }, []);

  if (!show) return null;

  async function install() {
    if (deferredPrompt) {
      (deferredPrompt as any).prompt();
      try {
        const { outcome } = await (deferredPrompt as any).userChoice;
        if (outcome === "accepted") { dismiss(); return; }
      } catch {}
    }
    dismiss();
  }

  function dismiss() {
    setShow(false);
    try { localStorage.setItem("pwa-banner-dismissed", "1"); } catch {}
  }

  return (
    <div style={{
      position: "fixed", bottom: 16, left: 16, right: 16, zIndex: 9999,
      background: "#fff", borderRadius: 16,
      boxShadow: "0 8px 32px rgba(0,0,0,0.15)", border: "1px solid #e5e7eb",
      padding: "14px 16px",
      display: "flex", alignItems: "center", gap: 12,
      maxWidth: 440, margin: "0 auto",
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
        background: "linear-gradient(135deg, #7C3AED, #2563EB)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#fff", fontSize: 18, fontWeight: 800,
      }}>Z</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#1d1d1f" }}>
          Nainštaluj Zlavickovo ako appku! 📱
        </div>
        <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
          Rýchlejší prístup, offline podpora
        </div>
      </div>
      <button
        onClick={install}
        style={{
          background: "linear-gradient(135deg, #7C3AED, #2563EB)",
          color: "#fff", border: "none", padding: "8px 14px",
          borderRadius: 8, fontSize: 13, fontWeight: 700,
          cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit",
        }}
      >
        Nainštalovať
      </button>
      <button
        onClick={dismiss}
        aria-label="Zavrieť"
        style={{
          background: "none", border: "none", fontSize: 20,
          color: "#aaa", cursor: "pointer", padding: "2px 6px",
          lineHeight: 1, fontFamily: "inherit", flexShrink: 0,
        }}
      >×</button>
    </div>
  );
}
