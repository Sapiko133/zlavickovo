"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import ShopFavicon from "@/components/ShopFavicon";
import CouponTypeBadge from "@/components/CouponTypeBadge";
import { getShopDomain } from "@/lib/shop-domains";
import { trackClick } from "@/lib/track-click";
import { normalizeShopSlug } from "@/lib/slug";

const TYPE_LABELS: Record<number, string> = {
  1: "Zľava", 2: "Darček", 3: "Výpredaj", 4: "Iné", 5: "Doprava zadarmo",
};

function decodeCode(token: string): string {
  try { const d = atob(token); return d.slice(d.indexOf(":") + 1); } catch { return ""; }
}

interface CouponInput {
  id?: string | number;
  campaign?: { name?: string | null } | null;
  campaign_name?: string | null;
  title?: string | null;
  name?: string | null;
  description?: string | null;
  code?: string | null;
  affiliate_link?: string | null;
  url?: string | null;
  valid_to?: string | null;
  type?: number;
}

export default function CouponCard({ coupon, token, sponsored }: {
  coupon: CouponInput; token?: string | null; sponsored?: boolean;
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
  const typeLabel     = TYPE_LABELS[coupon.type ?? -1] || "Akcia";

  const handleReveal = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (link) {
      window.open(link, "_blank", "noopener,noreferrer")
    }
    trackClick({
      type: "coupon_reveal",
      shopSlug: normalizeShopSlug(storeName),
      couponId: coupon.id ? String(coupon.id) : null,
      couponCode: code || null,
      destination: link || null,
      destinationDomain: domain || null,
    })
    setRevealed(true)
  }

  function copyCode() {
    if (!code) return;
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Jednotné CTA štýly (accent token = green-700 pre WCAG kontrast s bielym textom).
  const ctaStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "center",
    width: "100%", padding: "12px", minHeight: 44,
    borderRadius: "var(--control-radius)", border: "none",
    background: "var(--color-accent-primary)", color: "var(--color-accent-primary-text)",
    fontWeight: 700, fontSize: 14, cursor: "pointer",
    fontFamily: "var(--font-family-body)", textDecoration: "none",
    transition: "var(--control-transition)",
  };

  return (
    <div style={{
      background: "var(--card-bg)",
      borderRadius: "var(--card-radius)",
      border: "var(--card-border)",
      boxShadow: "var(--card-shadow)",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      position: "relative",
      height: "100%",
      fontFamily: "var(--font-family-body)",
      transition: "box-shadow var(--duration-fast) var(--easing-default), transform var(--duration-fast) var(--easing-default)",
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = "var(--card-shadow-hover)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "var(--card-shadow)"; e.currentTarget.style.transform = "none"; }}
    >
      {/* Discount ribbon */}
      {discountPct && (
        <div style={{
          position: "absolute", top: 12, right: 12,
          background: "var(--color-brand-primary)", color: "#fff",
          fontWeight: 800, fontSize: 11,
          padding: "3px 9px", borderRadius: "var(--radius-full)",
          letterSpacing: "0.02em",
        }}>
          -{discountPct}
        </div>
      )}

      {/* Header */}
      <div style={{
        padding: "14px 16px 12px",
        display: "flex", alignItems: "center", gap: 10,
        borderBottom: "1px solid var(--color-border-secondary)",
      }}>
        <div style={{
          width: 42, height: 42, borderRadius: "var(--radius-md)", flexShrink: 0,
          background: "var(--color-bg-tertiary)",
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden",
        }}>
          <ShopFavicon domain={domain} name={storeName} size={36} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {storeName}
          </div>
          {expires && (
            <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 2 }}>
              Platí do {expires}
            </div>
          )}
        </div>
        {sponsored ? (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: "var(--radius-full)", flexShrink: 0,
            background: "var(--color-status-warning-bg)", color: "var(--color-status-warning)",
          }}>
            {t("sponsored")}
          </span>
        ) : (
          <CouponTypeBadge kind={(token || code) ? "kupon" : "akcia"} />
        )}
      </div>

      {/* Body */}
      <div style={{ padding: "12px 16px 10px", flex: 1 }}>
        <span style={{
          display: "inline-block", fontSize: 10, fontWeight: 600, color: "var(--color-text-saving)",
          background: "var(--color-brand-subtle)", padding: "2px 8px", borderRadius: "var(--radius-full)", marginBottom: 8,
        }}>
          {typeLabel}
        </span>
        <div style={{ fontWeight: 600, fontSize: 13, color: "var(--color-text-primary)", lineHeight: 1.45, marginBottom: 6 }}>
          {coupon.title || coupon.name}
        </div>
        {coupon.description && (
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.55 }}>
            {coupon.description.length > 80 ? coupon.description.slice(0, 80) + "…" : coupon.description}
          </div>
        )}
      </div>

      {/* Footer CTA */}
      <div style={{ padding: "10px 16px 14px", borderTop: "1px dashed var(--color-border-secondary)" }}>
        {(token || code) ? (
          revealed ? (
            <div>
              {/* Code box */}
              <div
                onClick={copyCode}
                title={t("copy")}
                style={{
                  fontFamily: "var(--font-family-mono)",
                  fontWeight: 700, fontSize: 15, color: "var(--color-text-saving)",
                  background: "var(--color-brand-subtle)", border: "1.5px dashed var(--color-brand-primary)",
                  borderRadius: "var(--radius-md)", padding: "9px 14px",
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
                  width: "100%", padding: "9px", borderRadius: "var(--radius-md)",
                  border: `1px solid ${copied ? "var(--color-brand-primary)" : "var(--color-border-primary)"}`,
                  background: copied ? "var(--color-brand-subtle)" : "var(--color-surface-primary)",
                  color: copied ? "var(--color-text-saving)" : "var(--color-text-secondary)",
                  fontWeight: 600, fontSize: 13, cursor: "pointer",
                  fontFamily: "var(--font-family-body)", transition: "var(--control-transition)",
                }}
              >
                {copied ? "✓ " + t("copied") : t("copy")}
              </button>
            </div>
          ) : (
            <button
              onClick={handleReveal}
              style={ctaStyle}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--color-accent-primary-hover)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "var(--color-accent-primary)"; }}
            >
              {t("show_code")}
            </button>
          )
        ) : (
          <a
            href={link || "#"} target="_blank" rel="noopener noreferrer nofollow"
            onClick={() => {
              if (link) fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: "", shop: storeName }) }).catch(() => {});
              trackClick({
                type: "coupon_outbound",
                shopSlug: normalizeShopSlug(storeName),
                couponId: coupon.id ? String(coupon.id) : null,
                destination: link || null,
                destinationDomain: domain || null,
              });
            }}
            style={ctaStyle}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--color-accent-primary-hover)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "var(--color-accent-primary)"; }}
          >
            {t("go_to_shop")} →
          </a>
        )}
      </div>
    </div>
  );
}
