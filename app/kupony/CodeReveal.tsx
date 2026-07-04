"use client";

import { useState } from "react";

function decodeToken(token: string): string {
  try {
    const d = atob(token);
    return d.slice(d.indexOf(":") + 1);
  } catch {
    return "";
  }
}

export default function CodeReveal({
  token,
  link,
  shopName,
}: {
  token: string | null;
  link?: string;
  shopName?: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const code = token ? decodeToken(token) : null;

  function handleReveal() {
    if (link) window.open(link, "_blank", "noopener,noreferrer");
    setRevealed(true);
    if (code) {
      navigator.clipboard.writeText(code).catch(() => {});
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, shop: shopName || "" }),
      }).catch(() => {});
    }
  }

  function handleCopy() {
    if (!code) return;
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!code && !link) {
    return (
      <div style={{ padding: "10px 0", fontSize: 13, color: "#aaa", textAlign: "center" }}>
        Bez kódu – zľava sa aplikuje automaticky
      </div>
    );
  }

  if (!code) {
    return (
      <a
        href={link || "#"}
        target="_blank"
        rel="nofollow noopener noreferrer"
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "12px 10px", minHeight: 44, borderRadius: 9,
          background: "#22C55E", color: "#fff", fontWeight: 700,
          fontSize: 14, textAlign: "center", textDecoration: "none",
          boxShadow: "0 4px 14px rgba(34,197,94,0.3)",
        }}
      >
        Prejsť na ponuku ↗
      </a>
    );
  }

  if (!revealed) {
    return (
      <button
        onClick={handleReveal}
        style={{
          width: "100%", padding: "12px 10px", minHeight: 44,
          borderRadius: 9, border: "none",
          background: "#22C55E", color: "#fff", fontWeight: 700,
          fontSize: 14, cursor: "pointer", fontFamily: "inherit",
          boxShadow: "0 4px 14px rgba(34,197,94,0.3)",
        }}
      >
        Zobraziť kód ✂️
      </button>
    );
  }

  return (
    <div>
      <div
        onClick={handleCopy}
        title="Kliknúť pre kopírovanie"
        style={{
          fontFamily: "monospace", fontWeight: 800, fontSize: 15,
          color: "#16A34A", background: "#F0FDF4",
          border: "2px dashed #22C55E", borderRadius: 7,
          padding: "9px 12px", letterSpacing: 2,
          textAlign: "center", cursor: "pointer", marginBottom: 7,
        }}
      >
        {code}
      </div>
      <button
        onClick={handleCopy}
        style={{
          width: "100%", padding: "8px", borderRadius: 7,
          border: "1px solid #e5e7eb",
          background: copied ? "#16a34a" : "#fff",
          color: copied ? "#fff" : "#444",
          fontWeight: 600, fontSize: 13, cursor: "pointer",
          fontFamily: "inherit", transition: "background 0.15s, color 0.15s",
        }}
      >
        {copied ? "✓ Skopírované" : "Kopírovať kód"}
      </button>
    </div>
  );
}
