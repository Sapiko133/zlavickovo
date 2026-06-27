"use client";

import { useState } from "react";

type Tab = "kupony" | "akcie";

const TYPE_LABELS: Record<number, string> = {
  1: "Zľava", 2: "Darček", 3: "Výpredaj", 4: "Iné", 5: "Doprava zadarmo",
};

function decodeCode(token: string): string {
  try {
    const d = atob(token);
    return d.slice(d.indexOf(":") + 1);
  } catch {
    return "";
  }
}

function CouponRow({ coupon, capitalized }: { coupon: any; capitalized: string }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const link = coupon.affiliate_link || coupon.url;
  const hasCode = !!coupon._token;
  const code = hasCode ? decodeCode(coupon._token) : null;
  const expires = coupon.valid_to
    ? new Date(coupon.valid_to).toLocaleDateString("sk-SK")
    : null;

  function handleGetDeal() {
    if (link) window.open(link, "_blank", "noopener,noreferrer");
    setRevealed(true);
    if (code) {
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, shop: capitalized }),
      }).catch(() => {});
    }
  }

  function copyCode() {
    if (!code) return;
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{
      background: "#fff", border: "1px solid #eaecf0", borderRadius: 12,
      padding: "20px 24px", marginBottom: 10,
      display: "flex", alignItems: "flex-start", gap: 20,
      boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
    }}>
      {/* Left */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: "#dcfce7", color: "#16a34a" }}>
            ✓ Overený
          </span>
          {coupon.type && (
            <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: "#f1f5f9", color: "#475569" }}>
              {TYPE_LABELS[coupon.type] || "Akcia"}
            </span>
          )}
        </div>
        <div style={{ fontWeight: 700, fontSize: 16, color: "#1d1d1f", marginBottom: 6, lineHeight: 1.4 }}>
          {coupon.title || coupon.name}
        </div>
        {coupon.description && (
          <div style={{ fontSize: 13, color: "#666", lineHeight: 1.6 }}>
            {coupon.description.length > 150 ? coupon.description.slice(0, 150) + "..." : coupon.description}
          </div>
        )}
        {expires && (
          <div style={{ fontSize: 12, color: "#aaa", marginTop: 8 }}>
            Platí do: {expires}
          </div>
        )}
      </div>

      {/* Right */}
      <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
        {hasCode ? (
          revealed ? (
            <>
              <div
                onClick={copyCode}
                title="Kliknúť pre kopírovanie"
                style={{
                  fontFamily: "monospace", fontWeight: 800, fontSize: 16, color: "#7C3AED",
                  background: "#f5f3ff", border: "2px dashed #7C3AED", borderRadius: 8,
                  padding: "10px 18px", letterSpacing: 2, cursor: "pointer", whiteSpace: "nowrap",
                }}
              >
                {code}
              </div>
              <button
                onClick={copyCode}
                style={{
                  padding: "8px 18px", borderRadius: 8, border: "1px solid #e0e0e0",
                  background: copied ? "#16a34a" : "#fff",
                  color: copied ? "#fff" : "#444",
                  fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                }}
              >
                {copied ? "✓ Skopírované" : "Kopírovať"}
              </button>
            </>
          ) : (
            <button
              onClick={handleGetDeal}
              style={{
                padding: "13px 28px", borderRadius: 10, border: "none",
                background: "linear-gradient(135deg, #7C3AED, #2563EB)",
                color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer",
                whiteSpace: "nowrap", fontFamily: "inherit",
                boxShadow: "0 4px 14px rgba(124,58,237,0.25)",
              }}
            >
              Získať zľavu →
            </button>
          )
        ) : (
          <a
            href={link || "#"}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-block", padding: "13px 28px", borderRadius: 10,
              background: "linear-gradient(135deg, #7C3AED, #2563EB)",
              color: "#fff", fontWeight: 700, fontSize: 14, textDecoration: "none",
              whiteSpace: "nowrap", boxShadow: "0 4px 14px rgba(124,58,237,0.25)",
            }}
          >
            Prejsť na akciu →
          </a>
        )}
      </div>
    </div>
  );
}

interface ShopTabsProps {
  capitalized: string;
  codeCoupons: any[];
  dealCoupons: any[];
}

export default function ShopTabs({ capitalized, codeCoupons, dealCoupons }: ShopTabsProps) {
  const [tab, setTab] = useState<Tab>(codeCoupons.length > 0 ? "kupony" : "akcie");
  const displayed = tab === "kupony" ? codeCoupons : dealCoupons;

  return (
    <>
      <style>{`
        @media(max-width:640px){
          .coupon-row { flex-direction: column !important; }
          .coupon-row-right { align-items: stretch !important; width: 100%; }
          .coupon-row-right button, .coupon-row-right a { width: 100%; text-align: center; }
        }
      `}</style>

      {/* Tab bar */}
      <div style={{ display: "flex", borderBottom: "2px solid #f0f0f0", marginBottom: 20, overflowX: "auto" }}>
        {([
          { key: "kupony" as Tab, label: "🏷️ Kupóny", count: codeCoupons.length },
          { key: "akcie" as Tab, label: "🔥 Akcie", count: dealCoupons.length },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "12px 24px", border: "none", background: "none", cursor: "pointer",
              fontSize: 14, fontFamily: "inherit",
              fontWeight: tab === t.key ? 700 : 500,
              color: tab === t.key ? "#7C3AED" : "#666",
              borderBottom: tab === t.key ? "2px solid #7C3AED" : "2px solid transparent",
              marginBottom: -2, whiteSpace: "nowrap",
            }}
          >
            {t.label} <span style={{ fontSize: 12, opacity: 0.7 }}>({t.count})</span>
          </button>
        ))}
      </div>

      {/* List */}
      {displayed.length > 0 ? (
        <div>
          {displayed.map((coupon: any, i: number) => (
            <CouponRow key={coupon.id || i} coupon={coupon} capitalized={capitalized} />
          ))}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "56px 24px", color: "#aaa", background: "#fafafa", borderRadius: 12, border: "1px dashed #e0e0e0" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
          <p style={{ fontSize: 15, margin: 0, color: "#888" }}>
            Momentálne nie sú dostupné {tab === "kupony" ? "kupóny" : "akcie"} pre tento obchod.
          </p>
        </div>
      )}
    </>
  );
}
