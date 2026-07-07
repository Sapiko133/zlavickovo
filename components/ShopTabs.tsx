"use client";

import React, { useState } from "react";
import { T } from "@/lib/design-tokens";
import CouponTypeBadge from "@/components/CouponTypeBadge";
import { trackClick } from "@/lib/track-click";
import { normalizeShopSlug } from "@/lib/slug";

type Tab = "kupony" | "akcie";

const TYPE_LABELS: Record<number, string> = {
  1: "Zľava", 2: "Darček", 3: "Výpredaj", 4: "Iné", 5: "Doprava zadarmo",
};

function decodeCode(token: string): string {
  try { const d = atob(token); return d.slice(d.indexOf(":") + 1); } catch { return ""; }
}

function CouponRow({ coupon, capitalized }: { coupon: any; capitalized: string }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied]     = useState(false);

  const link    = coupon.affiliate_link || coupon.url;
  const hasCode = !!coupon._token;
  const code    = hasCode ? decodeCode(coupon._token) : null;
  const expires = coupon.valid_to ? new Date(coupon.valid_to).toLocaleDateString("sk-SK") : null;
  const discountMatch = (coupon.title || coupon.name || "").match(/(\d+)\s*%/);
  const discountPct   = discountMatch ? `-${discountMatch[1]}%` : null;
  const typeLabel     = TYPE_LABELS[coupon.type] || "Akcia";

  function handleGetDeal(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (link) window.open(link, "_blank", "noopener,noreferrer");
    if (code) {
      navigator.clipboard.writeText(code).catch(() => {});
      fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, shop: capitalized, affiliate_link: link || "" }) }).catch(() => {});
    } else if (link) {
      fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shop: capitalized, affiliate_link: link }) }).catch(() => {});
    }
    trackClick({
      type: code ? "coupon_reveal" : "coupon_outbound",
      shopSlug: normalizeShopSlug(capitalized),
      couponId: coupon.id ? String(coupon.id) : null,
      couponCode: code || null,
      destination: link || null,
    });
    setRevealed(true);
  }

  function copyCode() {
    if (!code) return;
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="coupon-row-inner" style={{
      background: T.white,
      border: `1px solid ${T.border}`,
      borderRadius: T.rLg,
      padding: "20px 22px",
      marginBottom: 10,
      display: "flex",
      alignItems: "flex-start",
      gap: 18,
      boxShadow: T.shadowXs,
      transition: "box-shadow 0.15s ease",
      fontFamily: T.fontSans,
    }}
      onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.boxShadow = T.shadowSm}
      onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.boxShadow = T.shadowXs}
    >
      {/* Left content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Badges */}
        <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
          <CouponTypeBadge kind={hasCode ? "kupon" : "akcia"} />
          <span style={{
            fontSize: 10, fontWeight: 600, padding: "3px 9px", borderRadius: T.rFull,
            background: T.bgAlt, color: T.textMuted,
          }}>{typeLabel}</span>
          {discountPct && (
            <span style={{
              fontSize: 10, fontWeight: 800, padding: "3px 9px", borderRadius: T.rFull,
              background: T.green, color: T.white,
            }}>{discountPct}</span>
          )}
        </div>

        {/* Title */}
        <div style={{ fontWeight: 700, fontSize: 15, color: T.textPrimary, lineHeight: 1.4, marginBottom: 6 }}>
          {coupon.title || coupon.name}
        </div>

        {/* Description */}
        {coupon.description && (
          <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.6 }}>
            {coupon.description.length > 160 ? coupon.description.slice(0, 160) + "…" : coupon.description}
          </div>
        )}

        {/* Expiry */}
        {expires && (
          <div style={{ fontSize: 11, color: T.textFaint, marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
            <span>⏱</span> Platí do {expires}
          </div>
        )}
      </div>

      {/* Right CTA */}
      <div className="coupon-row-cta" style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, minWidth: 160 }}>
        {hasCode ? (
          revealed ? (
            <>
              <div
                onClick={copyCode}
                title="Kliknúť pre kopírovanie"
                style={{
                  fontFamily: T.fontMono,
                  fontWeight: 700, fontSize: 15, color: T.greenDark,
                  background: T.greenLight, border: `1.5px dashed ${T.green}`,
                  borderRadius: T.rMd, padding: "10px 16px",
                  letterSpacing: "0.10em", cursor: "pointer",
                  textAlign: "center", width: "100%",
                  boxSizing: "border-box" as const,
                  userSelect: "all" as const,
                }}
              >
                {code}
              </div>
              <button
                onClick={copyCode}
                style={{
                  padding: "9px 20px", borderRadius: T.rMd, width: "100%",
                  border: `1px solid ${copied ? T.green : T.border}`,
                  background: copied ? T.greenLight : T.white,
                  color: copied ? T.greenDark : T.textSecond,
                  fontWeight: 600, fontSize: 13, cursor: "pointer",
                  fontFamily: T.fontSans, transition: T.transBase,
                }}
              >
                {copied ? "✓ Skopírované" : "Kopírovať"}
              </button>
            </>
          ) : (
            <button
              onClick={handleGetDeal}
              style={{
                padding: "13px 24px", borderRadius: T.rMd, border: "none",
                background: `linear-gradient(135deg, ${T.green} 0%, ${T.greenDark} 100%)`,
                color: T.white, fontWeight: 700, fontSize: 14, cursor: "pointer",
                whiteSpace: "nowrap", fontFamily: T.fontSans,
                boxShadow: T.shadowGreen, transition: T.transBase,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = T.shadowGreenLg; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = "none"; (e.currentTarget as HTMLButtonElement).style.boxShadow = T.shadowGreen; }}
            >
              Zobraziť kód
            </button>
          )
        ) : (
          <a
            href={link || "#"} target="_blank" rel="noopener noreferrer nofollow"
            onClick={() => {
              if (link) fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: "", shop: capitalized }) }).catch(() => {});
              trackClick({
                type: "action_outbound",
                shopSlug: normalizeShopSlug(capitalized),
                couponId: coupon.id ? String(coupon.id) : null,
                destination: link || null,
              });
            }}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              padding: "13px 24px", borderRadius: T.rMd,
              background: `linear-gradient(135deg, ${T.green} 0%, ${T.greenDark} 100%)`,
              color: T.white, fontWeight: 700, fontSize: 14, textDecoration: "none",
              whiteSpace: "nowrap", boxShadow: T.shadowGreen, transition: T.transBase,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-1px)"; (e.currentTarget as HTMLAnchorElement).style.boxShadow = T.shadowGreenLg; }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.transform = "none"; (e.currentTarget as HTMLAnchorElement).style.boxShadow = T.shadowGreen; }}
          >
            Prejsť na ponuku →
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
  shopUrl?: string;
}

export default function ShopTabs({ capitalized, codeCoupons, dealCoupons, shopUrl }: ShopTabsProps) {
  const [tab, setTab] = useState<Tab>(codeCoupons.length > 0 ? "kupony" : "akcie");
  const displayed = tab === "kupony" ? codeCoupons : dealCoupons;

  return (
    <div style={{ fontFamily: T.fontSans }}>
      <style>{`
        @media(max-width:640px){
          .coupon-row-inner { flex-direction: column !important; }
          .coupon-row-cta { min-width: unset !important; width: 100% !important; align-items: stretch !important; }
          .coupon-row-cta button, .coupon-row-cta a { width: 100% !important; }
        }
      `}</style>

      {/* Tab bar — zobrazí len taby s obsahom */}
      {(codeCoupons.length > 0 || dealCoupons.length > 0) && (
      <div style={{
        display: "flex", gap: 4, marginBottom: 20,
        background: T.bgAlt, borderRadius: T.rLg, padding: 4,
        width: "fit-content",
      }}>
        {([
          { key: "kupony" as Tab, label: "🏷️ Kupóny s kódom", count: codeCoupons.length },
          { key: "akcie"  as Tab, label: "🔥 Akcie",          count: dealCoupons.length },
        ]).filter(t => t.count > 0).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "9px 20px", border: "none", cursor: "pointer",
              fontSize: 13, fontFamily: T.fontSans, borderRadius: T.rMd,
              fontWeight: tab === t.key ? 700 : 500,
              background: tab === t.key ? T.white : "transparent",
              color: tab === t.key ? T.textPrimary : T.textMuted,
              boxShadow: tab === t.key ? T.shadowXs : "none",
              transition: T.transBase, whiteSpace: "nowrap",
            }}
          >
            {t.label}&nbsp;
            <span style={{
              fontSize: 11, fontWeight: 700,
              padding: "1px 7px", borderRadius: T.rFull,
              background: tab === t.key ? T.greenMid : T.border,
              color: tab === t.key ? T.greenDark : T.textMuted,
            }}>{t.count}</span>
          </button>
        ))}
      </div>
      )}

      {/* Coupon list */}
      {displayed.length > 0 ? (
        <div>
          {displayed.map((coupon: any, i: number) => (
            <CouponRow key={coupon.id || i} coupon={coupon} capitalized={capitalized} />
          ))}
        </div>
      ) : codeCoupons.length === 0 && dealCoupons.length === 0 && shopUrl ? (
        <div style={{
          textAlign: "center", padding: "48px 24px",
          background: T.bgAlt, borderRadius: T.rLg,
          border: `1px dashed ${T.border}`,
        }}>
          <div style={{ fontSize: 40, marginBottom: 14 }}>🛒</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.textSecond, marginBottom: 8 }}>
            Momentálne nemáme kupóny pre tento obchod.
          </div>
          <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 24 }}>
            Klikni a nakúp cez náš odkaz — podporíš nás bez extra nákladov.
          </div>
          <a
            href={shopUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            onClick={() => trackClick({
              type: "shop_outbound",
              shopSlug: normalizeShopSlug(capitalized),
              destination: shopUrl || null,
            })}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "14px 28px", borderRadius: T.rMd,
              background: `linear-gradient(135deg, ${T.green} 0%, ${T.greenDark} 100%)`,
              color: T.white, fontWeight: 700, fontSize: 15,
              textDecoration: "none", boxShadow: T.shadowGreen,
            }}
          >
            Prejsť do {capitalized} →
          </a>
        </div>
      ) : (
        <div style={{
          textAlign: "center", padding: "56px 24px",
          background: T.bgAlt, borderRadius: T.rLg,
          border: `1px dashed ${T.border}`,
        }}>
          <div style={{ fontSize: 44, marginBottom: 14 }}>🔍</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.textSecond, marginBottom: 6 }}>
            Momentálne žiadne {tab === "kupony" ? "kupóny" : "akcie"}
          </div>
          <div style={{ fontSize: 13, color: T.textMuted }}>
            Pozri AI sekciu nižšie — hľadáme kódy za teba
          </div>
        </div>
      )}
    </div>
  );
}
