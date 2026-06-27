"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import ShopLogo from "@/components/ShopLogo";
import { getShopDomain } from "@/lib/shop-domains";

const SHOP_COLORS = ["#E8001D","#0065BD","#00A551","#FF6900","#7B2FBE","#003580","#D32F2F","#FF4081"];
function shopColor(name: string) { return SHOP_COLORS[name.charCodeAt(0) % SHOP_COLORS.length]; }

function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(code).catch(()=>{}); setCopied(true); setTimeout(()=>setCopied(false),2000); }}
      style={{ padding:"3px 10px", borderRadius:6, border:"1.5px dashed #22C55E", background:copied?"#22C55E":"#F0FDF4", color:copied?"#fff":"#16A34A", fontWeight:700, fontSize:12, cursor:"pointer", fontFamily:"monospace", letterSpacing:1 }}
    >
      {copied ? "✓" : code}
    </button>
  );
}

function SearchResults() {
  const params = useSearchParams();
  const q = params.get("q") || "";
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    if (!q) return;
    setLoading(true);
    setData(null);
    fetch("/api/search-v2", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q }),
    })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [q]);

  const webResults = data?.webResults || [];
  const visible = showMore ? webResults : webResults.slice(0, 5);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px 64px", display: "flex", gap: 28, alignItems: "flex-start" }}>
      <style>{`
        @media(max-width:768px){ .search-layout { flex-direction:column !important; } .search-sidebar { width:100% !important; } }
        .result-card:hover { box-shadow:0 4px 20px rgba(0,0,0,0.08) !important; }
        .open-btn:hover { background:#16A34A !important; }
      `}</style>

      {/* ── LEFT: Results ── */}
      <div style={{ flex: 1, minWidth: 0 }} className="search-layout">

        {/* Title */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px", color: "#1d1d1f" }}>
            Výsledky pre: <span style={{ color: "#22C55E" }}>{q}</span>
          </h1>
          {data?.webResults?.length > 0 && (
            <div style={{ fontSize: 13, color: "#888", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ background: "#FFF7ED", color: "#EA580C", borderRadius: 4, padding: "2px 7px", fontSize: 11, fontWeight: 700 }}>ⓘ</span>
              Výsledky sú nájdené na webe a nemusia byť vždy aktuálne.
            </div>
          )}
        </div>

        {loading && (
          <div style={{ padding: "60px 0", textAlign: "center" }}>
            <div style={{ width: 36, height: 36, border: "3px solid #f0f0f0", borderTopColor: "#22C55E", borderRadius: "50%", margin: "0 auto 16px", animation: "spin 0.8s linear infinite" }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            <div style={{ color: "#888", fontSize: 14 }}>Hľadám výsledky...</div>
          </div>
        )}

        {/* Feed products (future) */}
        {data?.feedProducts?.length > 0 && (
          <section style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#22C55E", marginBottom: 12, letterSpacing: "0.5px", textTransform: "uppercase" }}>Produkty z partnerských obchodov</div>
            {/* TODO: FeedProduct cards */}
          </section>
        )}

        {/* Web results */}
        {visible.map((item: any, i: number) => (
          <div key={i} className="result-card" style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e8e8", padding: "18px 20px", marginBottom: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.04)", transition: "box-shadow 0.15s" }}>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              {/* Logo */}
              <div style={{ flexShrink: 0, marginTop: 2 }}>
                <ShopLogo name={item.domain?.split(".")[0] || ""} size={44} radius={10} color={shopColor(item.domain || "x")} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <a href={item.link} target="_blank" rel="nofollow noopener noreferrer" style={{ fontWeight: 600, fontSize: 15, color: "#2563EB", textDecoration: "none", display: "block", marginBottom: 3 }}>
                  {item.title}
                </a>
                <div style={{ fontSize: 12, color: "#aaa", marginBottom: 6 }}>{item.domain}</div>
                <div style={{ fontSize: 13, color: "#555", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {item.snippet}
                </div>
                <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
                  <a href={item.link} target="_blank" rel="nofollow noopener noreferrer" className="open-btn" style={{ display: "inline-block", padding: "7px 16px", borderRadius: 8, background: "#22C55E", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none", transition: "background 0.15s" }}>
                    Otvoriť obchod ↗
                  </a>
                  <a href={item.link} target="_blank" rel="nofollow noopener noreferrer" style={{ fontSize: 13, color: "#2563EB", textDecoration: "none" }}>
                    Zobraziť na webe ›
                  </a>
                </div>
              </div>
            </div>
          </div>
        ))}

        {!showMore && webResults.length > 5 && (
          <button onClick={() => setShowMore(true)} style={{ width: "100%", padding: "12px", borderRadius: 10, border: "1.5px solid #22C55E", background: "#fff", color: "#22C55E", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit", marginTop: 4 }}>
            Zobraziť viac výsledkov ▾
          </button>
        )}

        {!loading && data && webResults.length === 0 && data.coupons?.length === 0 && (
          <div style={{ padding: "48px 0", textAlign: "center", color: "#888" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>Žiadne výsledky pre „{q}"</div>
            <div style={{ fontSize: 14, marginTop: 6 }}>Skúste iný dotaz alebo prezrite naše obchody.</div>
          </div>
        )}
      </div>

      {/* ── RIGHT: Sidebar ── */}
      <div className="search-sidebar" style={{ width: 300, flexShrink: 0, display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Kupóny */}
        {(data?.coupons?.length > 0) && (
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8e8e8", padding: "18px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 18 }}>🏷️</span> Možné kupóny a zľavy
            </div>
            {data.coupons.slice(0, 5).map((c: any, i: number) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #f5f5f5" }}>
                <ShopLogo name={c.shopName} size={32} radius={8} color={shopColor(c.shopName)} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#1d1d1f", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.title?.length > 40 ? c.title.slice(0, 40) + "…" : c.title}
                  </div>
                  <div style={{ fontSize: 11, color: "#aaa" }}>{c.shopName}</div>
                </div>
                {c.code && <CopyCode code={c.code} />}
              </div>
            ))}
            <a href={`/kupony/${q.toLowerCase().replace(/\s+/g, "-")}`} style={{ display: "block", marginTop: 10, fontSize: 13, color: "#22C55E", textDecoration: "none", fontWeight: 600 }}>
              Zobraziť všetky kupóny ›
            </a>
          </div>
        )}

        {/* Letáky */}
        {(data?.letaky?.length > 0) && (
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8e8e8", padding: "18px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 18 }}>🗞️</span> Letáky obchodov
            </div>
            {data.letaky.map((l: any) => (
              <a key={l.slug} href={`/letaky/${l.slug}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #f5f5f5", textDecoration: "none" }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: l.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>{l.letter}</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "#1d1d1f" }}>{l.name} leták</div>
              </a>
            ))}
            <a href="/letaky" style={{ display: "block", marginTop: 10, fontSize: 13, color: "#22C55E", textDecoration: "none", fontWeight: 600 }}>
              Zobraziť všetky letáky ›
            </a>
          </div>
        )}

        {/* Heureka */}
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8e8e8", padding: "18px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 18 }}>🔍</span> Porovnajte cenu na Heureke
          </div>
          <p style={{ fontSize: 13, color: "#666", margin: "0 0 14px", lineHeight: 1.5 }}>
            Nájdite najlepšie ceny od overených predajcov.
          </p>
          <a
            href={`https://www.heureka.sk/?h%5Bfraze%5D=${encodeURIComponent(q)}&utm_source=zlavickovo&utm_medium=referral&positionid=71010`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 16px", borderRadius: 10, background: "#22C55E", color: "#fff", fontWeight: 700, fontSize: 14, textDecoration: "none" }}
          >
            🔍 Porovnať na Heureke ↗
          </a>
        </div>
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <Nav />

      {/* Footer info boxes */}
      <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "#aaa" }}>Načítavam...</div>}>
        <SearchResults />
      </Suspense>

      {/* Feature boxes */}
      <div style={{ background: "#fff", borderTop: "1px solid #e8e8e8", padding: "40px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 16 }}>
          {[
            { icon: "🏷️", title: "Kupóny a zľavy", desc: "Najlepšie kupóny a akcie na jednom mieste" },
            { icon: "💰", title: "Cashback", desc: "Získajte časť peňazí späť z nákupu" },
            { icon: "📋", title: "Letáky", desc: "Všetky aktuálne letáky obchodov" },
            { icon: "🛡️", title: "Bezpečné nákupy", desc: "Overené obchody a spoľahlivé odkazy" },
          ].map(b => (
            <div key={b.title} style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "16px", borderRadius: 12, background: "#f9fafb", border: "1px solid #e8e8e8" }}>
              <span style={{ fontSize: 28, flexShrink: 0 }}>{b.icon}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#1d1d1f", marginBottom: 4 }}>{b.title}</div>
                <div style={{ fontSize: 13, color: "#666", lineHeight: 1.4 }}>{b.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Footer />
    </div>
  );
}
