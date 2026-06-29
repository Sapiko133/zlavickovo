"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import ShopFavicon from "@/components/ShopFavicon";
import { getShopDomain } from "@/lib/shop-domains";
import { T } from "@/lib/design-tokens";

const TYPE_LABELS: Record<number, string> = {
  1: "Zľava", 2: "Darček", 3: "Výpredaj", 4: "Iné", 5: "Doprava zadarmo",
};

function decodeCode(token: string): string {
  try { const d = atob(token); return d.slice(d.indexOf(":") + 1); } catch { return ""; }
}

export default function CouponCard({ coupon, token, sponsored }: {
  coupon: any; token?: string | null; sponsored?: boolean;
}) {
  const t = useTranslations("coupon");
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied]     = useState(false);

  const storeName     = coupon.campaign?.name || coupon.campaign_name || "Obchod";
  const domain        = getShopDomain(storeName) || "";
  const link          = coupon.affiliate_link || coupon.url;
  const code          = token ? decodeCode(token) : coupon.code || null;
  const expires       = coupon.valid_to ? new Date(coupon.valid_to).toLocaleDateString("sk-SK") : null;
  const discountMatch = (coupon.title || coupon.name || "").match(/(\d+)\s*%/);
  const discountPct   = discountMatch ? `${discountMatch[1]}%` : null;
  const typeLabel     = TYPE_LABELS[coupon.type] || "Akcia";

  const handleReveal = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (link) {
      window.open(link, "_blank", "noopener,noreferrer")
    }
    setRevealed(true)
  }

  function copyCode() {
    if (!code) return;
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{
      background: T.white,
      borderRadius: T.rLg,
      border: `1px solid ${T.border}`,
      boxShadow: T.shadowSm,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      position: "relative",
      height: "100%",
      fontFamily: T.fontSans,
      transition: "box-shadow 0.18s ease, transform 0.18s ease",
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = T.shadowMd; (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = T.shadowSm; (e.currentTarget as HTMLDivElement).style.transform = "none"; }}
    >
      {/* Discount ribbon */}
      {discountPct && (
        <div style={{
          position: "absolute", top: 12, right: 12,
          background: T.green, color: T.white,
          fontWeight: 800, fontSize: 11,
          padding: "3px 9px", borderRadius: T.rFull,
          letterSpacing: "0.02em",
          boxShadow: T.shadowGreen,
        }}>
          -{discountPct}
        </div>
      )}

      {/* Header */}
      <div style={{
        padding: "14px 16px 12px",
        display: "flex", alignItems: "center", gap: 10,
        borderBottom: `1px solid ${T.borderLight}`,
      }}>
        <div style={{
          width: 42, height: 42, borderRadius: T.rMd, flexShrink: 0,
          background: T.bgAlt,
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden",
        }}>
          <ShopFavicon domain={domain} name={storeName} size={36} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: T.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {storeName}
          </div>
          {expires && (
            <div style={{ fontSize: 11, color: T.textFaint, marginTop: 2 }}>
              Platí do {expires}
            </div>
          )}
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: T.rFull, flexShrink: 0,
          ...(sponsored
            ? { background: "#FFF7ED", color: "#C2410C" }
            : { background: T.greenMid, color: T.greenDark }),
        }}>
          {sponsored ? t("sponsored") : "✓ Overený"}
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: "12px 16px 10px", flex: 1 }}>
        <span style={{
          display: "inline-block", fontSize: 10, fontWeight: 600, color: T.greenDark,
          background: T.greenLight, padding: "2px 8px", borderRadius: T.rFull, marginBottom: 8,
        }}>
          {typeLabel}
        </span>
        <div style={{ fontWeight: 600, fontSize: 13, color: T.textPrimary, lineHeight: 1.45, marginBottom: 6 }}>
          {coupon.title || coupon.name}
        </div>
        {coupon.description && (
          <div style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.55 }}>
            {coupon.description.length > 80 ? coupon.description.slice(0, 80) + "…" : coupon.description}
          </div>
        )}
      </div>

      {/* Footer CTA */}
      <div style={{ padding: "10px 16px 14px", borderTop: `1px dashed ${T.borderLight}` }}>
        {(token || code) ? (
          revealed ? (
            <div>
              {/* Code box */}
              <div
                onClick={copyCode}
                title={t("copy")}
                style={{
                  fontFamily: T.fontMono,
                  fontWeight: 700, fontSize: 15, color: T.greenDark,
                  background: T.greenLight, border: `1.5px dashed ${T.green}`,
                  borderRadius: T.rMd, padding: "9px 14px",
                  letterSpacing: "0.12em", textAlign: "center",
                  cursor: "pointer", marginBottom: 8,
                  userSelect: "all",
                }}
              >
                {code}
              </div>
              <button
                onClick={copyCode}
                style={{
                  width: "100%", padding: "9px", borderRadius: T.rMd,
                  border: `1px solid ${copied ? T.green : T.border}`,
                  background: copied ? T.greenLight : T.white,
                  color: copied ? T.greenDark : T.textSecond,
                  fontWeight: 600, fontSize: 13, cursor: "pointer",
                  fontFamily: T.fontSans, transition: T.transBase,
                }}
              >
                {copied ? "✓ " + t("copied") : t("copy")}
              </button>
            </div>
          ) : (
            <button
              onClick={handleReveal}
              style={{
                width: "100%", padding: "12px", minHeight: 44, borderRadius: T.rMd, border: "none",
                background: `linear-gradient(135deg, ${T.green} 0%, ${T.greenDark} 100%)`,
                color: T.white, fontWeight: 700, fontSize: 14, cursor: "pointer",
                fontFamily: T.fontSans, boxShadow: T.shadowGreen,
                transition: T.transBase, letterSpacing: "0.01em",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = T.shadowGreenLg; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = T.shadowGreen; (e.currentTarget as HTMLButtonElement).style.transform = "none"; }}
            >
              {t("show_code")}
            </button>
          )
        ) : (
          <a
            href={link || "#"} target="_blank" rel="noopener noreferrer nofollow"
            onClick={() => { if (link) fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: "", shop: storeName }) }).catch(() => {}); }}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "12px", minHeight: 44, borderRadius: T.rMd,
              background: `linear-gradient(135deg, ${T.green} 0%, ${T.greenDark} 100%)`,
              color: T.white, fontWeight: 700, fontSize: 14, textDecoration: "none",
              boxShadow: T.shadowGreen, transition: T.transBase,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.boxShadow = T.shadowGreenLg; (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.boxShadow = T.shadowGreen; (e.currentTarget as HTMLAnchorElement).style.transform = "none"; }}
          >
            {t("go_to_shop")} →
          </a>
        )}
      </div>
    </div>
  );
}
