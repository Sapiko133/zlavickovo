"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import SearchBar from "@/components/SearchBar";

const POPULAR = [
  "iPhone 16", "PlayStation 5", "Nike tenisky",
  "Samsung TV", "Parfumy", "Lidl leták",
];

export default function HeroSearch() {
  const t = useTranslations("hero");
  const router = useRouter();
  const [q, setQ] = useState("");

  function go(val?: string) {
    const v = (val ?? q).trim();
    if (!v) return;
    router.push("/hladat?q=" + encodeURIComponent(v));
  }

  return (
    <div style={{
      background: "linear-gradient(160deg, #F0FDF4 0%, #DCFCE7 50%, #F0FDF4 100%)",
      padding: "64px 24px 56px", textAlign: "center", borderBottom: "1px solid #BBF7D0",
      position: "relative", overflow: "hidden",
    }}>
      {/* BG decoration */}
      <div style={{ position:"absolute", top:-80, left:"10%", width:300, height:300, borderRadius:"50%", background:"rgba(34,197,94,0.08)", pointerEvents:"none" }} />
      <div style={{ position:"absolute", bottom:-60, right:"8%", width:240, height:240, borderRadius:"50%", background:"rgba(34,197,94,0.06)", pointerEvents:"none" }} />

      <div style={{ maxWidth: 700, margin: "0 auto", position: "relative" }}>
        <div style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"4px 14px", borderRadius:100, background:"rgba(34,197,94,0.12)", border:"1px solid #BBF7D0", fontSize:12, color:"#16A34A", marginBottom:20, fontWeight:600 }}>
          ✦ {t("badge")}
        </div>

        <h1 style={{ fontSize:"clamp(26px,5vw,48px)", fontWeight:800, color:"#1d1d1f", letterSpacing:"-1px", lineHeight:1.15, margin:"0 0 14px" }}>
          {t("title")}
        </h1>
        <p style={{ fontSize:16, color:"#555", margin:"0 auto 36px", maxWidth:520, lineHeight:1.6 }}>
          {t("subtitle")}
        </p>

        {/* Search bar with autocomplete */}
        <SearchBar />

        {/* Popular searches */}
        <div style={{ marginTop:20, display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap" }}>
          <span style={{ fontSize:13, color:"#888", marginRight:4 }}>{t("popular_label")}</span>
          {POPULAR.map(p => (
            <button
              key={p}
              onClick={() => go(p)}
              style={{
                padding:"5px 12px", borderRadius:100, border:"1px solid #BBF7D0",
                background:"rgba(255,255,255,0.8)", color:"#16A34A",
                fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"inherit",
              }}
              onMouseEnter={e => { e.currentTarget.style.background="#22C55E"; e.currentTarget.style.color="#fff"; e.currentTarget.style.borderColor="#22C55E"; }}
              onMouseLeave={e => { e.currentTarget.style.background="rgba(255,255,255,0.8)"; e.currentTarget.style.color="#16A34A"; e.currentTarget.style.borderColor="#BBF7D0"; }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
