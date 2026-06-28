"use client";

import { useState } from "react";
import ShopLogo from "@/components/ShopLogo";

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
  const [copied, setCopied] = useState(false);

  function handleReveal() {
    if (coupon.affiliateLink && coupon.affiliateLink !== "#") {
      window.open(coupon.affiliateLink, "_blank", "noopener,noreferrer");
    }
    setRevealed(true);
    navigator.clipboard.writeText(coupon.code).catch(() => {});
  }

  function handleCopy() {
    navigator.clipboard.writeText(coupon.code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ padding: "10px 0", borderBottom: isLast ? "none" : "1px solid #f0f0f0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <ShopLogo name={coupon.shopName} domain={coupon.domain} size={28} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1d1d1f", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {coupon.shopName}
          </div>
          <div style={{ fontSize: 11, color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {coupon.title.length > 28 ? coupon.title.slice(0, 28) + "…" : coupon.title}
          </div>
        </div>
        {coupon.discount && (
          <span style={{ fontSize: 10, fontWeight: 800, color: "#fff", background: "#22C55E", borderRadius: 5, padding: "2px 6px", flexShrink: 0 }}>
            {coupon.discount}
          </span>
        )}
      </div>
      {!revealed ? (
        <button
          onClick={handleReveal}
          style={{
            width: "100%", padding: "5px 10px", borderRadius: 7,
            border: "1.5px dashed #22C55E", background: "#F0FDF4", color: "#16A34A",
            fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: "inherit",
            letterSpacing: 1,
          }}
        >
          ••••••• Zobraziť
        </button>
      ) : (
        <button
          onClick={handleCopy}
          style={{
            width: "100%", padding: "5px 10px", borderRadius: 7,
            border: "1.5px solid #22C55E",
            background: copied ? "#22C55E" : "#F0FDF4",
            color: copied ? "#fff" : "#16A34A",
            fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: "monospace",
            letterSpacing: 1,
          }}
        >
          {copied ? "✓ Skopírované" : coupon.code}
        </button>
      )}
    </div>
  );
}

export default function HomeCouponSidebar({ coupons }: { coupons: SidebarCoupon[] }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: "#1d1d1f", marginBottom: 2 }}>🏷️ Najnovšie kupóny</div>
      <div style={{ fontSize: 11, color: "#aaa", marginBottom: 12 }}>Klikni pre zobrazenie kódu</div>
      {coupons.length === 0 ? (
        <div style={{ fontSize: 12, color: "#aaa", textAlign: "center", padding: "16px 0" }}>
          Žiadne kupóny
        </div>
      ) : (
        coupons.map((c, i) => (
          <CouponRow key={i} coupon={c} isLast={i === coupons.length - 1} />
        ))
      )}
      <a href="/kupony" style={{
        display: "block", marginTop: 14, textAlign: "center",
        padding: "8px 12px", borderRadius: 8, background: "#f5f5f7",
        color: "#22C55E", fontSize: 12, fontWeight: 700, textDecoration: "none",
      }}>
        Všetky kupóny →
      </a>
    </div>
  );
}
