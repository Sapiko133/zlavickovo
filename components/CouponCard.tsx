"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import ShopFavicon from "@/components/ShopFavicon";
import { getShopDomain } from "@/lib/shop-domains";
const TYPE_LABELS: Record<number, string> = {
  1: "Zľava", 2: "Darček", 3: "Výpredaj", 4: "Iné", 5: "Doprava zadarmo",
};

function decodeCode(token: string): string {
  try { const d = atob(token); return d.slice(d.indexOf(":") + 1); } catch { return ""; }
}

export default function CouponCard({ coupon, token, sponsored }: { coupon: any; token?: string | null; sponsored?: boolean }) {
  const t = useTranslations("coupon");
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const storeName = coupon.campaign?.name || coupon.campaign_name || "Obchod";
  const domain = getShopDomain(storeName) || "";
  const link = coupon.affiliate_link || coupon.url;
  const code = token ? decodeCode(token) : coupon.code || null;
  const expires = coupon.valid_to ? new Date(coupon.valid_to).toLocaleDateString("sk-SK") : null;
  const discountMatch = (coupon.title || coupon.name || "").match(/(\d+)\s*%/);
  const discountBadge = discountMatch ? `${discountMatch[1]}%` : null;

  function handleReveal() {
    if (link) window.open(link, "_blank", "noopener,noreferrer");
    setRevealed(true);
    if (code) {
      navigator.clipboard.writeText(code).catch(() => {});
      fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, shop: storeName }) }).catch(() => {});
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
      background: "#fff", borderRadius: 12, border: "1.5px solid #e5e7eb",
      boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
      display: "flex", flexDirection: "column", overflow: "hidden", position: "relative",
      height: "100%",
    }}>
      {/* Discount badge */}
      {discountBadge && (
        <div style={{
          position: "absolute", top: 10, right: 10,
          background: "#22C55E", color: "#fff", fontWeight: 800, fontSize: 11,
          padding: "3px 8px", borderRadius: 6,
          boxShadow: "0 2px 8px rgba(34,197,94,0.4)",
        }}>
          -{discountBadge}
        </div>
      )}

      {/* Header */}
      <div style={{ padding: "14px 16px 10px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid #f5f5f5" }}>
        <ShopFavicon domain={domain} name={storeName} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#1d1d1f", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{storeName}</div>
          {expires && <div style={{ fontSize: 11, color: "#aaa", marginTop: 1 }}>{t("expires")} {expires}</div>}
        </div>
        {sponsored ? (
          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 5, background: "#fff7ed", color: "#ea580c", flexShrink: 0 }}>{t("sponsored")}</span>
        ) : (
          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 5, background: "#dcfce7", color: "#16a34a", flexShrink: 0 }}>{t("verified")}</span>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: "12px 16px", flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#16A34A", background: "#F0FDF4", display: "inline-block", padding: "2px 8px", borderRadius: 4, marginBottom: 7 }}>
          {TYPE_LABELS[coupon.type] || "Akcia"}
        </div>
        <div style={{ fontWeight: 600, fontSize: 13, color: "#1d1d1f", lineHeight: 1.4, marginBottom: 5 }}>
          {coupon.title || coupon.name}
        </div>
        {coupon.description && (
          <div style={{ fontSize: 12, color: "#888", lineHeight: 1.5 }}>
            {coupon.description.length > 80 ? coupon.description.slice(0, 80) + "..." : coupon.description}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: "10px 16px 14px", borderTop: "1px dashed #f0f0f0" }}>
        {(token || code) ? (
          revealed ? (
            <div>
              <div onClick={copyCode} title={t("copy")} style={{ fontFamily: "monospace", fontWeight: 800, fontSize: 14, color: "#16A34A", background: "#F0FDF4", border: "2px dashed #22C55E", borderRadius: 7, padding: "8px 12px", letterSpacing: 2, textAlign: "center", cursor: "pointer", marginBottom: 7 }}>
                {code}
              </div>
              <button onClick={copyCode} style={{ width: "100%", padding: "8px", borderRadius: 7, border: "1px solid #e5e7eb", background: copied ? "#16a34a" : "#fff", color: copied ? "#fff" : "#444", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit", transition: "background 0.15s, color 0.15s" }}>
                {copied ? t("copied") : t("copy")}
              </button>
            </div>
          ) : (
            <button onClick={handleReveal} style={{ width: "100%", padding: "12px 10px", minHeight: 44, borderRadius: 9, border: "none", background: "#22C55E", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 14px rgba(34,197,94,0.35)" }}>
              {t("show_code")}
            </button>
          )
        ) : (
          <a href={link || "#"} target="_blank" rel="noopener noreferrer nofollow" onClick={() => { if (link) fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: "", shop: storeName }) }).catch(() => {}); }} style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "12px 10px", minHeight: 44, borderRadius: 9, background: "#22C55E", color: "#fff", fontWeight: 700, fontSize: 14, textAlign: "center", textDecoration: "none", boxShadow: "0 4px 14px rgba(34,197,94,0.35)" }}>
            {t("go_to_shop")}
          </a>
        )}
      </div>
    </div>
  );
}
