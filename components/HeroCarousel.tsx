"use client";

import { useState, useEffect, useCallback } from "react";

const SHOP_COLORS: Record<string, string> = {
  alza: "#0065BD", zalando: "#FF6900", shein: "#E8001D", mall: "#E31837",
  notino: "#8B1A1A", sportisimo: "#00A551", ikea: "#0058A3", dedoles: "#FF4081",
  martinus: "#D32F2F", zara: "#000000", hm: "#E50010", tchibo: "#7B3F20",
  lidl: "#0050AA", kaufland: "#E2001A", tesco: "#EE1C25", billa: "#C8002D",
};
const FALLBACK = ["#7C3AED","#0065BD","#E8001D","#00A551","#FF6900","#003580","#D32F2F"];

function shopColor(name: string) {
  const key = name.toLowerCase().split(" ")[0];
  return SHOP_COLORS[key] ?? FALLBACK[name.charCodeAt(0) % FALLBACK.length];
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
  const [fading, setFading] = useState(false);
  const count = items.length;

  const goTo = useCallback((idx: number) => {
    setFading(true);
    setTimeout(() => { setActive(idx); setFading(false); }, 220);
  }, []);

  const next = useCallback(() => goTo((active + 1) % count), [active, count, goTo]);
  const prev = () => goTo((active - 1 + count) % count);

  useEffect(() => {
    if (count < 2) return;
    const t = setInterval(next, 5000);
    return () => clearInterval(t);
  }, [count, next]);

  if (!items.length) return null;

  const item = items[active];
  const color = shopColor(item.shopName);
  const darkColor = color + "dd";

  return (
    <div style={{ position: "relative" }}>
      <style>{`
        @keyframes heroFadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .hero-content { animation: heroFadeIn 0.4s ease forwards; }
        .hero-cta { transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .hero-cta:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.2); }
        .hero-arrow { transition: background 0.15s, transform 0.15s; }
        .hero-arrow:hover { background: rgba(255,255,255,0.35) !important; transform: translateY(-50%) scale(1.1); }
        .hero-dot-btn { transition: background 0.2s, transform 0.2s; }
        .hero-dot-btn:active { transform: scale(0.85); }
        @media(max-width:640px){
          .hero-inner { flex-direction:column !important; padding:28px 20px 32px !important; min-height:auto !important; gap:20px !important; }
          .hero-avatar { width:72px !important; height:72px !important; font-size:32px !important; border-radius:18px !important; }
          .hero-title { font-size:19px !important; }
          .hero-shop-name { font-size:14px !important; }
        }
      `}</style>

      {/* Banner */}
      <div style={{
        background: `linear-gradient(135deg, ${color} 0%, ${darkColor} 60%, ${color}88 100%)`,
        position: "relative", overflow: "hidden",
        boxShadow: "0 8px 40px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)",
      }}>
        {/* Gloss overlay */}
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(180deg,rgba(255,255,255,0.1) 0%,transparent 50%)", pointerEvents:"none" }} />
        {/* Decorative orbs */}
        <div style={{ position:"absolute", top:-80, right:-80, width:280, height:280, borderRadius:"50%", background:"rgba(255,255,255,0.06)", pointerEvents:"none" }} />
        <div style={{ position:"absolute", bottom:-60, left:-60, width:220, height:220, borderRadius:"50%", background:"rgba(255,255,255,0.04)", pointerEvents:"none" }} />
        <div style={{ position:"absolute", top:"30%", right:"20%", width:120, height:120, borderRadius:"50%", background:"rgba(255,255,255,0.05)", pointerEvents:"none" }} />

        <div
          className="hero-inner"
          key={active}
          style={{
            maxWidth: 1100, margin: "0 auto", padding: "52px 40px",
            display: "flex", alignItems: "center", gap: 48, minHeight: 300, boxSizing: "border-box",
            opacity: fading ? 0 : 1, transition: "opacity 0.22s ease",
          }}
        >
          {/* Avatar — glassmorphism */}
          <div className="hero-avatar" style={{
            width: 120, height: 120, borderRadius: 28, flexShrink: 0,
            background: "rgba(255,255,255,0.15)",
            backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
            border: "1.5px solid rgba(255,255,255,0.35)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 900, fontSize: 52, letterSpacing: -2,
          }}>
            {item.shopName.charAt(0).toUpperCase()}
          </div>

          {/* Text */}
          <div className="hero-content" style={{ flex: 1, minWidth: 0 }}>
            {item.discount && (
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 12,
                background: "rgba(255,255,255,0.95)", color: color,
                fontWeight: 800, fontSize: 13, padding: "5px 14px", borderRadius: 100,
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              }}>
                🏷️ {item.discount} ZĽAVA
              </div>
            )}
            <div className="hero-shop-name" style={{ color: "rgba(255,255,255,0.85)", fontSize: 15, fontWeight: 600, marginBottom: 8, letterSpacing: "0.2px" }}>
              {item.shopName}
            </div>
            <div className="hero-title" style={{ color: "#fff", fontSize: 28, fontWeight: 800, lineHeight: 1.2, marginBottom: 24, letterSpacing: "-0.5px", textShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>
              {item.title.length > 90 ? item.title.slice(0, 90) + "…" : item.title}
            </div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="hero-cta"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "13px 28px", borderRadius: 12,
                  background: "#fff", color: color,
                  fontWeight: 800, fontSize: 14, textDecoration: "none",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                }}
              >
                Zobraziť akciu →
              </a>
              {item.expires && (
                <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 500 }}>
                  ⏱ Platí do {item.expires}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Arrows */}
        {count > 1 && (
          <>
            <button onClick={prev} aria-label="Predchádzajúce" className="hero-arrow" style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", width:40, height:40, borderRadius:"50%", border:"none", background:"rgba(255,255,255,0.18)", backdropFilter:"blur(8px)", color:"#fff", fontSize:20, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>‹</button>
            <button onClick={next} aria-label="Ďalšie" className="hero-arrow" style={{ position:"absolute", right:14, top:"50%", transform:"translateY(-50%)", width:40, height:40, borderRadius:"50%", border:"none", background:"rgba(255,255,255,0.18)", backdropFilter:"blur(8px)", color:"#fff", fontSize:20, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>›</button>
          </>
        )}
      </div>

      {/* Dot indicators */}
      {count > 1 && (
        <div style={{ display:"flex", gap:6, justifyContent:"center", padding:"10px 0 2px", background:"#fff" }}>
          {items.map((_, i) => (
            <button key={i} className="hero-dot-btn" onClick={() => goTo(i)} aria-label={`Slide ${i + 1}`} style={{ width: i === active ? 20 : 7, height:7, borderRadius:100, border:"none", cursor:"pointer", padding:0, background: i === active ? "#7C3AED" : "#ddd", transition:"all 0.25s ease" }} />
          ))}
        </div>
      )}
    </div>
  );
}
