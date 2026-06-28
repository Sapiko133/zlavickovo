"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ShopFavicon from "@/components/ShopFavicon";
import type { CarouselDeal } from "@/lib/dognet";

const STATIC_FALLBACK: CarouselDeal[] = [
  { shop: "Alza",    domain: "alza.sk",    title: "Až 20% zľava na elektroniku",    discount: "20%", color: "#0065BD", affiliateUrl: "https://www.alza.sk" },
  { shop: "Zalando", domain: "zalando.sk", title: "Výpredaj módy až -50%",          discount: "50%", color: "#FF6900", affiliateUrl: "https://www.zalando.sk" },
  { shop: "Notino",  domain: "notino.sk",  title: "Parfémy so zľavou až 30%",       discount: "30%", color: "#8B1A1A", affiliateUrl: "https://www.notino.sk" },
  { shop: "GymBeam", domain: "gymbeam.sk", title: "Proteíny a doplnky -15%",        discount: "15%", color: "#FF6B35", affiliateUrl: "https://www.gymbeam.sk" },
  { shop: "Mall",    domain: "mall.sk",    title: "Domáce spotrebiče v akcii -25%", discount: "25%", color: "#E31837", affiliateUrl: "https://www.mall.sk" },
];

interface Props {
  initialDeals?: CarouselDeal[];
}

export default function DealsCarousel({ initialDeals }: Props) {
  const deals = (initialDeals && initialDeals.length > 0) ? initialDeals : STATIC_FALLBACK;
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);
  const count = deals.length;

  const next = useCallback(() => setCurrent(c => (c + 1) % count), [count]);
  const prev = useCallback(() => setCurrent(c => (c - 1 + count) % count), [count]);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(next, 4000);
    return () => clearInterval(t);
  }, [next, paused]);

  const deal = deals[current];

  function handleCardClick() {
    const url = deal.affiliateUrl;
    if (!url || url === "#") return;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div
      style={{ position: "relative", overflow: "hidden", transition: "background 0.5s ease", background: deal.color, cursor: "pointer" }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={e => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={e => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 44) dx < 0 ? next() : prev();
        touchX.current = null;
      }}
      onClick={handleCardClick}
      role="link"
      tabIndex={0}
      aria-label={`${deal.shop}: ${deal.title}`}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") handleCardClick(); }}
    >
      {/* Slide content */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        maxWidth: 1200, margin: "0 auto",
        padding: "clamp(20px,4vw,44px) clamp(20px,5vw,64px)",
        gap: 24,
        minHeight: "clamp(120px,16vw,170px)",
      }}>
        {/* Left: favicon + text */}
        <div style={{ display: "flex", alignItems: "center", gap: 22, flex: 1, minWidth: 0 }}>
          <div style={{
            width: 72, height: 72, borderRadius: 18, flexShrink: 0,
            background: "rgba(255,255,255,0.18)",
            display: "flex", alignItems: "center", justifyContent: "center",
            backdropFilter: "blur(4px)",
          }}>
            <ShopFavicon domain={deal.domain} name={deal.shop} size={50} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>
              {deal.shop}
            </div>
            <div style={{
              fontSize: "clamp(16px,2.4vw,26px)", fontWeight: 800, color: "#fff",
              lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis",
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const,
            }}>
              {deal.title}
            </div>
          </div>
        </div>

        {/* Right: badge + CTA */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, flexShrink: 0 }}>
          {deal.discount && (
            <div style={{
              fontSize: "clamp(26px,4vw,40px)", fontWeight: 900, color: "#fff",
              background: "rgba(0,0,0,0.20)", borderRadius: 12,
              padding: "8px 20px", lineHeight: 1, letterSpacing: "-1px",
            }}>
              -{deal.discount}
            </div>
          )}
          <div style={{
            padding: "11px 26px", borderRadius: 10,
            background: "#fff", color: "#1a1a1a",
            fontWeight: 700, fontSize: 14, whiteSpace: "nowrap",
            boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
          }}>
            Využiť akciu →
          </div>
        </div>
      </div>

      {/* Prev arrow */}
      <button
        onClick={e => { e.stopPropagation(); prev(); }}
        aria-label="Predchádzajúci"
        style={{
          position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
          width: 40, height: 40, borderRadius: "50%", border: "none",
          background: "rgba(0,0,0,0.28)", color: "#fff", cursor: "pointer",
          fontSize: 24, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2,
        }}
      >‹</button>

      {/* Next arrow */}
      <button
        onClick={e => { e.stopPropagation(); next(); }}
        aria-label="Nasledujúci"
        style={{
          position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
          width: 40, height: 40, borderRadius: "50%", border: "none",
          background: "rgba(0,0,0,0.28)", color: "#fff", cursor: "pointer",
          fontSize: 24, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2,
        }}
      >›</button>

      {/* Dots */}
      <div style={{
        position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)",
        display: "flex", gap: 6, zIndex: 2,
      }}>
        {deals.map((_, i) => (
          <button
            key={i}
            onClick={e => { e.stopPropagation(); setCurrent(i); }}
            aria-label={`Slide ${i + 1}`}
            style={{
              width: i === current ? 24 : 8, height: 8, borderRadius: 4,
              border: "none", cursor: "pointer", padding: 0,
              background: i === current ? "#fff" : "rgba(255,255,255,0.45)",
              transition: "width 0.3s, background 0.3s",
            }}
          />
        ))}
      </div>
    </div>
  );
}
