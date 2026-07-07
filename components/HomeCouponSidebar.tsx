"use client";

import React, { useState } from "react";
import ShopFavicon from "@/components/ShopFavicon";
import CouponTypeBadge from "@/components/CouponTypeBadge";
import { T } from "@/lib/design-tokens";
import { trackClick } from "@/lib/track-click";
import { normalizeShopSlug } from "@/lib/slug";

export interface SidebarCoupon {
  shopName: string;
  domain?: string;
  title: string;
  discount: string | null;
  code: string;
  affiliateLink: string;
}

function CouponRow({ coupon, isLast }: { coupon: SidebarCoupon; isLast: boolean }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied]     = useState(false);

  function handleReveal(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (coupon.affiliateLink && coupon.affiliateLink !== "#") {
      window.open(coupon.affiliateLink, "_blank", "noopener,noreferrer");
    }
    trackClick({
      type: "coupon_reveal",
      shopSlug: normalizeShopSlug(coupon.shopName),
      couponCode: coupon.code || null,
      destination: coupon.affiliateLink || null,
      destinationDomain: coupon.domain || null,
    });
    navigator.clipboard.writeText(coupon.code).catch(() => {});
    setRevealed(true);
  }

  function handleCopy() {
    navigator.clipboard.writeText(coupon.code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{
      padding: "10px 0",
      borderBottom: isLast ? "none" : `1px solid ${T.borderLight}`,
    }}>
      {/* Shop row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
        <div style={{
          width: 30, height: 30, borderRadius: T.rSm, flexShrink: 0,
          background: T.bgAlt, display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden",
        }}>
          <ShopFavicon domain={coupon.domain || ""} name={coupon.shopName} size={26} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {coupon.shopName}
          </div>
          <div style={{ fontSize: 10, color: T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>
            {coupon.title.length > 26 ? coupon.title.slice(0, 26) + "…" : coupon.title}
          </div>
        </div>
        <CouponTypeBadge kind="kupon" />
        {coupon.discount && (
          <span style={{
            fontSize: 10, fontWeight: 800, color: T.white, background: T.green,
            borderRadius: T.rFull, padding: "2px 7px", flexShrink: 0,
          }}>
            {coupon.discount}
          </span>
        )}
      </div>

      {/* Code reveal */}
      {!revealed ? (
        <button
          onClick={handleReveal}
          style={{
            width: "100%", padding: "6px 10px", borderRadius: T.rMd,
            border: `1.5px dashed ${T.green}`, background: T.greenLight,
            color: T.greenDark, fontWeight: 700, fontSize: 11, cursor: "pointer",
            fontFamily: T.fontSans, letterSpacing: "0.04em", transition: T.transBase,
          }}
          onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = T.greenMid}
          onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = T.greenLight}
        >
          ••••• Zobraziť kód
        </button>
      ) : (
        <button
          onClick={handleCopy}
          style={{
            width: "100%", padding: "6px 10px", borderRadius: T.rMd,
            border: `1.5px solid ${copied ? T.green : T.greenDark}`,
            background: copied ? T.green : T.greenLight,
            color: copied ? T.white : T.greenDark,
            fontWeight: 700, fontSize: 11, cursor: "pointer",
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: "0.08em", transition: T.transBase,
          }}
        >
          {copied ? "✓ Skopírované!" : coupon.code}
        </button>
      )}
    </div>
  );
}

export default function HomeCouponSidebar({ coupons }: { coupons: SidebarCoupon[] }) {
  // Sekcia bez obsahu sa nezobrazuje
  if (coupons.length === 0) return null;

  return (
    <div style={{
      background: T.white, borderRadius: T.rLg, border: `1px solid ${T.border}`,
      padding: "16px 16px 12px", boxShadow: T.shadowSm,
      fontFamily: T.fontSans,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: T.textPrimary }}>🏷️ Najnovšie kupóny</div>
      </div>
      <div style={{ fontSize: 11, color: T.textFaint, marginBottom: 12 }}>Klikni pre zobrazenie kódu</div>

      {coupons.length === 0 ? (
        <div style={{ fontSize: 12, color: T.textFaint, textAlign: "center", padding: "20px 0" }}>
          Žiadne kupóny
        </div>
      ) : (
        coupons.map((c, i) => (
          <CouponRow key={i} coupon={c} isLast={i === coupons.length - 1} />
        ))
      )}

      <a href="/kupony" style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
        marginTop: 14, padding: "8px 12px", borderRadius: T.rMd,
        background: T.greenLight, color: T.greenDark,
        fontSize: 12, fontWeight: 700, textDecoration: "none",
        border: `1px solid ${T.greenMid}`, transition: T.transBase,
      }}
        onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.background = T.greenMid}
        onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.background = T.greenLight}
      >
        Všetky kupóny →
      </a>
    </div>
  );
}
