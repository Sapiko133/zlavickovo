"use client";

import { useState, useEffect, useCallback } from "react";

const SHOP_COLORS: Record<string, string> = {
  alza: "#0065BD", zalando: "#FF6900", shein: "#E8001D", mall: "#E31837",
  notino: "#8B1A1A", sportisimo: "#00A551", ikea: "#0058A3", dedoles: "#FF4081",
  martinus: "#D32F2F", zara: "#000000", hm: "#E50010", tchibo: "#7B3F20",
  lidl: "#0050AA", kaufland: "#E2001A", tesco: "#EE1C25", billa: "#C8002D",
};

const FALLBACK_COLORS = ["#7C3AED","#0065BD","#E8001D","#00A551","#FF6900","#003580","#D32F2F"];

function shopColor(name: string): string {
  const key = name.toLowerCase().split(" ")[0];
  return SHOP_COLORS[key] ?? FALLBACK_COLORS[name.charCodeAt(0) % FALLBACK_COLORS.length];
}

export type HeroItem = {
  id: string | number;
  shopName: string;
  title: string;
  discount?: string | null;
  link: string;
  expires?: string | null;
};

export default function HeroCarousel({ items }: { items: HeroItem[] }) {
  const [active, setActive] = useState(0);
  const count = items.length;

  const next = useCallback(() => setActive(a => (a + 1) % count), [count]);
  const prev = () => setActive(a => (a - 1 + count) % count);

  useEffect(() => {
    if (count < 2) return;
    const t = setInterval(next, 5000);
    return () => clearInterval(t);
  }, [count, next]);

  if (!items.length) return null;

  const item = items[active];
  const color = shopColor(item.shopName);

  return (
    <div style={{ position: "relative", overflow: "hidden" }}>
      <style>{`
        .hero-card { transition: opacity 0.35s ease; }
        .hero-dot { width: 7px; height: 7px; border-radius: 50%; border: none; cursor: pointer; padding: 0; transition: background 0.2s; }
        @media(max-width:640px){
          .hero-inner { flex-direction: column !important; padding: 28px 20px !important; min-height: 220px !important; }
          .hero-letter { font-size: 60px !important; width: 80px !important; height: 80px !important; }
          .hero-title { font-size: 18px !important; }
          .hero-shop { font-size: 24px !important; }
        }
      `}</style>

      {/* Main card */}
      <div
        className="hero-card"
        style={{
          background: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)`,
          minHeight: 280, position: "relative", overflow: "hidden",
        }}
      >
        {/* Decorative circles */}
        <div style={{ position: "absolute", top: -60, right: -60, width: 240, height: 240, borderRadius: "50%", background: "rgba(255,255,255,0.07)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -40, left: -40, width: 180, height: 180, borderRadius: "50%", background: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />

        <div className="hero-inner" style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 32px", display: "flex", alignItems: "center", gap: 40, minHeight: 280, boxSizing: "border-box" }}>
          {/* Shop letter */}
          <div className="hero-letter" style={{
            width: 110, height: 110, borderRadius: 24, flexShrink: 0,
            background: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 900, fontSize: 52, letterSpacing: -2,
          }}>
            {item.shopName.charAt(0).toUpperCase()}
          </div>

          {/* Text */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {item.discount && (
              <div style={{
                display: "inline-block", marginBottom: 10,
                background: "#fff", color: color,
                fontWeight: 800, fontSize: 13, padding: "4px 12px", borderRadius: 100,
              }}>
                {item.discount} ZĽAVA
              </div>
            )}
            <div className="hero-shop" style={{ color: "rgba(255,255,255,0.9)", fontSize: 18, fontWeight: 600, marginBottom: 6 }}>
              {item.shopName}
            </div>
            <div className="hero-title" style={{ color: "#fff", fontSize: 26, fontWeight: 800, lineHeight: 1.25, marginBottom: 20 }}>
              {item.title.length > 80 ? item.title.slice(0, 80) + "…" : item.title}
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer nofollow"
                style={{
                  display: "inline-block", padding: "12px 24px", borderRadius: 10,
                  background: "#fff", color: color,
                  fontWeight: 700, fontSize: 14, textDecoration: "none",
                }}
              >
                Zobraziť akciu →
              </a>
              {item.expires && (
                <span style={{ color: "rgba(255,255,255,0.75)", fontSize: 12 }}>
                  Platí do {item.expires}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Prev / Next arrows */}
        {count > 1 && (
          <>
            <button
              onClick={prev}
              aria-label="Predchádzajúce"
              style={{
                position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
                width: 36, height: 36, borderRadius: "50%", border: "none",
                background: "rgba(255,255,255,0.2)", color: "#fff",
                fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >‹</button>
            <button
              onClick={next}
              aria-label="Ďalšie"
              style={{
                position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                width: 36, height: 36, borderRadius: "50%", border: "none",
                background: "rgba(255,255,255,0.2)", color: "#fff",
                fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >›</button>
          </>
        )}
      </div>

      {/* Dot indicators */}
      {count > 1 && (
        <div style={{ display: "flex", gap: 6, justifyContent: "center", padding: "12px 0 4px", background: "#fff" }}>
          {items.map((_, i) => (
            <button
              key={i}
              className="hero-dot"
              onClick={() => setActive(i)}
              style={{ background: i === active ? "#7C3AED" : "#ddd" }}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
