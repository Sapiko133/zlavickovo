"use client";

import { useState } from "react";
import { trackClick } from "@/lib/track-click";
import { normalizeShopSlug } from "@/lib/slug";

interface Props {
  token: string;
  affiliateLink?: string;
  shop?: string;
}

export default function RevealCode({ token, affiliateLink, shop }: Props) {
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reveal() {
    setLoading(true);
    setError(null);

    // Otvoriť affiliate link SYNCHRONNE – musí byť pred akýmkoľvek await,
    // inak ho prehliadač zablokuje ako popup (nie user gesture).
    const hasLink = !!(affiliateLink && affiliateLink !== "#");
    if (hasLink) {
      window.open(affiliateLink, "_blank", "noopener,noreferrer");
    }

    trackClick({
      type: "coupon_reveal",
      shopSlug: shop ? normalizeShopSlug(shop) : null,
      destination: hasLink ? affiliateLink : null,
    });

    try {
      const res = await fetch("/api/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setCode(data.code);
        if (shop && data.code) {
          fetch("/api/track", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: data.code, shop }),
          }).catch(() => {});
        }
      }
    } catch {
      setError("Chyba siete");
    }
    setLoading(false);
  }

  if (error) return (
    <div style={{ padding: "10px 14px", background: "#fff5f5", borderRadius: 8, color: "#c0392b", fontSize: 13, textAlign: "center" }}>
      {error}
    </div>
  );

  if (!code) return (
    <button
      onClick={reveal}
      disabled={loading}
      style={{
        width: "100%", padding: "11px 14px", borderRadius: 9,
        background: loading ? "#d1d5db" : "linear-gradient(135deg, #7C3AED, #2563EB)",
        color: "#fff", border: "none", fontWeight: 700, fontSize: 14,
        cursor: loading ? "wait" : "pointer", transition: "opacity 0.15s",
        fontFamily: "inherit",
      }}
    >
      {loading ? "Načítavam..." : "🎁 Zobraziť kód"}
    </button>
  );

  return (
    <div style={{ display: "flex", gap: 8 }}>
      {/* Chars in individual spans — DOM scraper gets fragmented text, copy uses JS var */}
      <div style={{
        flex: 1, padding: "10px 14px", background: "#fafafa",
        borderRadius: 8, border: "2px dashed #7C3AED",
        fontWeight: 800, fontSize: 14, color: "#7C3AED",
        letterSpacing: 2, textAlign: "center",
      }}>
        {code.split("").map((ch, i) => <span key={i}>{ch}</span>)}
      </div>
      <button
        onClick={() => {
          navigator.clipboard.writeText(code).catch(() => {});
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        style={{
          padding: "10px 14px", borderRadius: 8,
          background: copied ? "#16a34a" : "#1d1d1f",
          color: "#fff", border: "none", fontWeight: 700, fontSize: 13,
          cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit",
        }}
      >
        {copied ? "✓" : "Kopírovať"}
      </button>
    </div>
  );
}
