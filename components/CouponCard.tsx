"use client";

import { useState } from "react";

const COLORS = ["#E8001D","#0065BD","#00A551","#FF6900","#7B2FBE","#003580","#D32F2F","#FF4081","#006A35","#8B1A1A"];
const TYPE_LABELS: Record<number, string> = {
  1: "Zľava", 2: "Darček", 3: "Výpredaj", 4: "Iné", 5: "Doprava zadarmo",
};

function decodeCode(token: string): string {
  try { const d = atob(token); return d.slice(d.indexOf(":") + 1); } catch { return ""; }
}

export default function CouponCard({ coupon, token, sponsored }: { coupon: any; token?: string | null; sponsored?: boolean }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const storeName = coupon.campaign?.name || coupon.campaign_name || "Obchod";
  const logoColor = COLORS[storeName.charCodeAt(0) % COLORS.length];
  const link = coupon.affiliate_link || coupon.url;
  const code = token ? decodeCode(token) : null;
  const expires = coupon.valid_to ? new Date(coupon.valid_to).toLocaleDateString("sk-SK") : null;
  const discountMatch = (coupon.title || coupon.name || "").match(/(\d+)\s*%/);
  const discountBadge = discountMatch ? `${discountMatch[1]}%` : null;

  function handleShowCode() {
    if (link) window.open(link, "_blank", "noopener,noreferrer");
    setRevealed(true);
    if (code) fetch("/api/track", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ code, shop:storeName }) }).catch(()=>{});
  }

  function copyCode() {
    if (!code) return;
    navigator.clipboard.writeText(code).catch(()=>{});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{
      background:"#fff", borderRadius:12, border:"1.5px solid #e8e8e8",
      boxShadow:"0 2px 6px rgba(0,0,0,0.04)",
      display:"flex", flexDirection:"column", overflow:"hidden", position:"relative",
      height:"100%",
    }}>
      {/* Discount badge */}
      {discountBadge && (
        <div style={{
          position:"absolute", top:10, right:10,
          background:"linear-gradient(135deg,#7C3AED,#5b21b6)",
          color:"#fff", fontWeight:800, fontSize:11,
          padding:"3px 8px", borderRadius:6,
          boxShadow:"0 2px 8px rgba(124,58,237,0.4)",
        }}>
          -{discountBadge}
        </div>
      )}

      {/* Header */}
      <div style={{ padding:"14px 16px 10px", display:"flex", alignItems:"center", gap:10, borderBottom:"1px solid #f5f5f5" }}>
        <div style={{ width:40, height:40, borderRadius:10, background:logoColor, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:900, fontSize:16, boxShadow:`0 3px 10px ${logoColor}44` }}>
          {storeName.charAt(0)}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:700, fontSize:13, color:"#1d1d1f", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{storeName}</div>
          {expires && <div style={{ fontSize:11, color:"#aaa", marginTop:1 }}>do {expires}</div>}
        </div>
        {sponsored ? (
          <span style={{ fontSize:10, fontWeight:700, padding:"2px 6px", borderRadius:5, background:"#fff7ed", color:"#ea580c", flexShrink:0 }}>Sponz.</span>
        ) : (
          <span style={{ fontSize:10, fontWeight:700, padding:"2px 6px", borderRadius:5, background:"#dcfce7", color:"#16a34a", flexShrink:0 }}>✓</span>
        )}
      </div>

      {/* Body */}
      <div style={{ padding:"12px 16px", flex:1 }}>
        <div style={{ fontSize:11, fontWeight:600, color:"#7C3AED", background:"#f0eeff", display:"inline-block", padding:"2px 8px", borderRadius:4, marginBottom:7 }}>
          {TYPE_LABELS[coupon.type] || "Akcia"}
        </div>
        <div style={{ fontWeight:600, fontSize:13, color:"#1d1d1f", lineHeight:1.4, marginBottom:5 }}>
          {coupon.title || coupon.name}
        </div>
        {coupon.description && (
          <div style={{ fontSize:12, color:"#888", lineHeight:1.5 }}>
            {coupon.description.length > 80 ? coupon.description.slice(0,80)+"..." : coupon.description}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding:"10px 16px 14px", borderTop:"1px dashed #f0f0f0" }}>
        {token ? (
          revealed ? (
            <div>
              <div onClick={copyCode} title="Kliknúť pre kopírovanie" style={{ fontFamily:"monospace", fontWeight:800, fontSize:14, color:"#7C3AED", background:"#f0eeff", border:"2px dashed #7C3AED", borderRadius:7, padding:"8px 12px", letterSpacing:2, textAlign:"center", cursor:"pointer", marginBottom:7 }}>
                {code}
              </div>
              <button onClick={copyCode} style={{ width:"100%", padding:"8px", borderRadius:7, border:"1px solid #e8e8e8", background:copied?"#16a34a":"#fff", color:copied?"#fff":"#444", fontWeight:600, fontSize:13, cursor:"pointer", fontFamily:"inherit", transition:"background 0.15s, color 0.15s" }}>
                {copied ? "✓ Skopírované" : "Kopírovať"}
              </button>
            </div>
          ) : (
            <button onClick={handleShowCode} style={{ width:"100%", padding:"10px", borderRadius:9, border:"none", background:"linear-gradient(135deg,#7C3AED,#5b21b6)", color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer", fontFamily:"inherit", boxShadow:"0 4px 14px rgba(124,58,237,0.35)" }}>
              Získať kód
            </button>
          )
        ) : (
          <a href={link||"#"} target="_blank" rel="noopener noreferrer nofollow" style={{ display:"block", padding:"10px", borderRadius:9, background:"linear-gradient(135deg,#7C3AED,#5b21b6)", color:"#fff", fontWeight:700, fontSize:14, textAlign:"center", textDecoration:"none", boxShadow:"0 4px 14px rgba(124,58,237,0.35)" }}>
            Prejsť na akciu →
          </a>
        )}
      </div>
    </div>
  );
}
