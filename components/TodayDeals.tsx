"use client";

import React, { useState } from "react";
import ShopFavicon from "@/components/ShopFavicon";
import CouponTypeBadge from "@/components/CouponTypeBadge";
import { trackClick } from "@/lib/track-click";
import { normalizeShopSlug } from "@/lib/slug";

export interface DealItem {
  kind: "kupon" | "akcia";
  shopName: string;
  domain?: string;
  title: string;
  discount: string | null;
  /** len pri kind === "kupon" */
  code?: string;
  /** VŽDY trackovaný affiliate odkaz (go.dognet / affial / eHub / CJ) */
  affiliateLink: string;
  validTo?: string | null;
}

const ORANGE = "#F97316";
const ORANGE_DARK = "#EA580C";

function validLabel(validTo?: string | null): string {
  if (!validTo) return "Priebežná ponuka";
  const d = new Date(validTo);
  if (isNaN(d.getTime())) return "Priebežná ponuka";
  return `Platí do ${d.toLocaleDateString("sk-SK")}`;
}

/** KUPÓN karta — kód je skrytý; klik otvorí affiliate odkaz a odhalí kód. */
function KuponCard({ deal }: { deal: DealItem }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleReveal(e: React.MouseEvent) {
    e.preventDefault();
    if (deal.affiliateLink && deal.affiliateLink !== "#") {
      window.open(deal.affiliateLink, "_blank", "noopener,noreferrer");
    }
    trackClick({
      type: "coupon_reveal",
      shopSlug: normalizeShopSlug(deal.shopName),
      couponCode: deal.code || null,
      destination: deal.affiliateLink || null,
      destinationDomain: deal.domain || null,
    });
    if (deal.code) navigator.clipboard.writeText(deal.code).catch(() => {});
    setRevealed(true);
  }

  function handleCopy() {
    if (deal.code) navigator.clipboard.writeText(deal.code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="deal-card" style={cardStyle}>
      <CardHead deal={deal} />
      <div style={titleStyle}>{deal.title}</div>
      <div style={{ marginTop: "auto", paddingTop: 10 }}>
        <div style={{ fontSize: 11, color: "#aaa", marginBottom: 8 }}>{validLabel(deal.validTo)}</div>
        {!revealed ? (
          <button onClick={handleReveal}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px dashed #22C55E", background: "#f0fdf4", color: "#15803d", fontWeight: 800, fontSize: 13, cursor: "pointer", letterSpacing: "0.04em" }}>
            ••••• Zobraziť kód
          </button>
        ) : (
          <button onClick={handleCopy}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${copied ? "#22C55E" : "#15803d"}`, background: copied ? "#22C55E" : "#f0fdf4", color: copied ? "#fff" : "#15803d", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em" }}>
            {copied ? "✓ Skopírované!" : deal.code}
          </button>
        )}
      </div>
    </div>
  );
}

/** AKCIA karta — bez kódu; celá karta je trackovaný affiliate odkaz. */
function AkciaCard({ deal }: { deal: DealItem }) {
  return (
    <a href={deal.affiliateLink} target="_blank" rel="nofollow noopener noreferrer" className="deal-card"
      onClick={() => trackClick({
        type: "action_outbound",
        shopSlug: normalizeShopSlug(deal.shopName),
        destination: deal.affiliateLink || null,
        destinationDomain: deal.domain || null,
      })}
      style={{ ...cardStyle, textDecoration: "none", color: "#1d1d1f" }}>
      <CardHead deal={deal} />
      <div style={titleStyle}>{deal.title}</div>
      <div style={{ marginTop: "auto", paddingTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 11, color: "#aaa" }}>{validLabel(deal.validTo)}</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: "#fff", background: ORANGE, borderRadius: 8, padding: "7px 14px", whiteSpace: "nowrap" }}>Využiť →</span>
      </div>
    </a>
  );
}

function CardHead({ deal }: { deal: DealItem }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
      <ShopFavicon domain={deal.domain || ""} name={deal.shopName} size={40} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#1d1d1f", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{deal.shopName}</div>
        <div style={{ marginTop: 3 }}><CouponTypeBadge kind={deal.kind} /></div>
      </div>
      {deal.discount && (
        <span style={{ fontSize: 13, fontWeight: 800, color: ORANGE_DARK, whiteSpace: "nowrap", flexShrink: 0 }}>{deal.discount}</span>
      )}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  display: "flex", flexDirection: "column",
  background: "#fff", borderRadius: 16, border: "1.5px solid #eceff3",
  padding: "16px 16px 16px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  minHeight: 168,
};

const titleStyle: React.CSSProperties = {
  fontSize: 13.5, fontWeight: 600, lineHeight: 1.4,
  display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical",
  overflow: "hidden", color: "#374151",
};

export default function TodayDeals({ deals }: { deals: DealItem[] }) {
  if (deals.length === 0) return null;
  return (
    <>
      <style>{`
        .deal-card { transition: transform .18s ease, box-shadow .18s ease, border-color .15s; }
        .deal-card:hover { transform: translateY(-3px); box-shadow: 0 10px 28px rgba(0,0,0,0.10) !important; border-color: ${ORANGE} !important; }
        .deals-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
        @media(max-width: 960px) { .deals-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        @media(max-width: 520px) { .deals-grid { grid-template-columns: 1fr !important; } }
      `}</style>
      <div className="deals-grid">
        {deals.map((d, i) => d.kind === "kupon"
          ? <KuponCard key={i} deal={d} />
          : <AkciaCard key={i} deal={d} />
        )}
      </div>
    </>
  );
}
