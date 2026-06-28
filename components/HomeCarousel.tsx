"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ShopFavicon from "@/components/ShopFavicon";
import { getShopDomain } from "@/lib/shop-domains";

export interface CarouselSlide {
  id: number | string;
  shopName: string;
  title: string;
  discount: string | null;
  link: string;
  expires: string | null;
}

const GRADIENTS = [
  "linear-gradient(135deg,#22C55E 0%,#15803D 100%)",
  "linear-gradient(135deg,#0065BD 0%,#003d73 100%)",
  "linear-gradient(135deg,#E8001D 0%,#9b0013 100%)",
  "linear-gradient(135deg,#FF6900 0%,#c44f00 100%)",
  "linear-gradient(135deg,#7C3AED 0%,#4c1d95 100%)",
  "linear-gradient(135deg,#0ea5e9 0%,#075985 100%)",
];

export default function HomeCarousel({ slides }: { slides: CarouselSlide[] }) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);

  const count = Math.min(slides.length, 6);
  const next = useCallback(() => setCurrent(c => (c + 1) % count), [count]);
  const prev = useCallback(() => setCurrent(c => (c - 1 + count) % count), [count]);

  useEffect(() => {
    if (paused || count < 2) return;
    const t = setInterval(next, 4000);
    return () => clearInterval(t);
  }, [next, paused, count]);

  if (count === 0) return null;

  const slide = slides[current];
  const bg = GRADIENTS[current % GRADIENTS.length];

  return (
    <div
      style={{ position: "relative", background: bg, overflow: "hidden" }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={e => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={e => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 44) dx < 0 ? next() : prev();
        touchX.current = null;
      }}
    >
      <a
        href={slide.link}
        target="_blank"
        rel="nofollow noopener noreferrer"
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          maxWidth: 1200, margin: "0 auto",
          padding: "clamp(24px,4vw,40px) clamp(20px,4vw,56px)",
          textDecoration: "none", gap: 24, minHeight: "clamp(130px,18vw,180px)",
        }}
      >
        {/* Left */}
        <div style={{ display: "flex", alignItems: "center", gap: 20, flex: 1, minWidth: 0 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: "rgba(255,255,255,0.18)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, backdropFilter: "blur(4px)",
          }}>
            <ShopFavicon domain={getShopDomain(slide.shopName) || ""} name={slide.shopName} size={44} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
              {slide.shopName}
            </div>
            <div style={{
              fontSize: "clamp(15px,2.2vw,22px)", fontWeight: 800, color: "#fff",
              lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis",
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
            }}>
              {slide.title}
            </div>
            {slide.expires && (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 8 }}>
                Platí do {slide.expires}
              </div>
            )}
          </div>
        </div>

        {/* Right */}
        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          {slide.discount && (
            <div style={{
              fontSize: "clamp(24px,3.5vw,36px)", fontWeight: 900, color: "#fff",
              background: "rgba(0,0,0,0.18)", borderRadius: 12,
              padding: "8px 18px", lineHeight: 1, letterSpacing: "-1px",
            }}>
              -{slide.discount}
            </div>
          )}
          <div style={{
            padding: "11px 26px", borderRadius: 10,
            background: "#fff", color: "#1a1a1a",
            fontWeight: 700, fontSize: 14, whiteSpace: "nowrap",
            boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
          }}>
            Využiť akciu →
          </div>
        </div>
      </a>

      {/* Prev / Next */}
      {count > 1 && <>
        <button
          onClick={e => { e.preventDefault(); prev(); }}
          style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 40, height: 40, borderRadius: "50%", background: "rgba(0,0,0,0.28)", border: "none", color: "#fff", cursor: "pointer", fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }}
          aria-label="Predchádzajúci"
        >‹</button>
        <button
          onClick={e => { e.preventDefault(); next(); }}
          style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", width: 40, height: 40, borderRadius: "50%", background: "rgba(0,0,0,0.28)", border: "none", color: "#fff", cursor: "pointer", fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }}
          aria-label="Nasledujúci"
        >›</button>
      </>}

      {/* Dots */}
      {count > 1 && (
        <div style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 6, zIndex: 2 }}>
          {Array.from({ length: count }).map((_, i) => (
            <button
              key={i}
              onClick={e => { e.preventDefault(); setCurrent(i); }}
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
      )}
    </div>
  );
}
