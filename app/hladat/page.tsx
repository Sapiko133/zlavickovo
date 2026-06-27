"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import ShopLogo from "@/components/ShopLogo";

const SHOP_COLORS = ["#E8001D","#0065BD","#00A551","#FF6900","#22C55E","#003580","#D32F2F","#FF4081"];
function shopColor(name: string) { return SHOP_COLORS[name.charCodeAt(0) % SHOP_COLORS.length]; }

function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(code).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      style={{ padding: "3px 10px", borderRadius: 6, border: "1.5px dashed #22C55E", background: copied ? "#22C55E" : "#F0FDF4", color: copied ? "#fff" : "#16A34A", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "monospace", letterSpacing: 1 }}
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

  const coupons: any[] = data?.coupons || [];
  const cashback: any[] = data?.cashback || [];
  const letaky: any[] = data?.letaky || [];

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px 64px", display: "flex", gap: 28, alignItems: "flex-start" }}>
      <style>{`
        @media(max-width:768px){ .search-layout { flex-direction:column !important; } .search-sidebar { width:100% !important; } }
        .result-card:hover { box-shadow:0 4px 20px rgba(0,0,0,0.08) !important; }
      `}</style>

      {/* LEFT: Results */}
      <div style={{ flex: 1, minWidth: 0 }} className="search-layout">

        {/* Title */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px", color: "#1d1d1f" }}>
            Výsledky pre: <span style={{ color: "#22C55E" }}>{q}</span>
          </h1>
          <div style={{ fontSize: 13, color: "#888" }}>
            Kupóny a zľavy z Dognet a Affial partnerských sietí
          </div>
        </div>

        {loading && (
          <div style={{ padding: "60px 0", textAlign: "center" }}>
            <div style={{ width: 36, height: 36, border: "3px solid #f0f0f0", borderTopColor: "#22C55E", borderRadius: "50%", margin: "0 auto 16px", animation: "spin 0.8s linear infinite" }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            <div style={{ color: "#888", fontSize: 14 }}>Hľadám výsledky...</div>
          </div>
        )}

        {/* Coupons in main column */}
        {!loading && coupons.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#22C55E", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>
              Kupóny a zľavy ({coupons.length})
            </div>
            {coupons.map((c: any, i: number) => (
              <div key={i} className="result-card" style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "18px 20px", marginBottom: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.04)", transition: "box-shadow 0.15s" }}>
                <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <ShopLogo name={c.shopName} size={44} radius={10} color={shopColor(c.shopName)} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: "#1d1d1f", marginBottom: 3 }}>{c.title}</div>
                    <div style={{ fontSize: 12, color: "#aaa", marginBottom: 8 }}>{c.shopName}</div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      {c.code && <CopyCode code={c.code} />}
                      <a href={c.link} target="_blank" rel="nofollow noopener noreferrer" style={{ display: "inline-block", padding: "7px 16px", borderRadius: 8, background: "#22C55E", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
                        Otvoriť obchod ↗
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Cashback in main column */}
        {!loading && cashback.length > 0 && (
          <div style={{ marginTop: coupons.length ? 28 : 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#16A34A", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>
              Cashback obchody
            </div>
            {cashback.map((s: any, i: number) => (
              <div key={i} className="result-card" style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "16px 20px", marginBottom: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.04)", display: "flex", alignItems: "center", gap: 14, transition: "box-shadow 0.15s" }}>
                <ShopLogo name={s.name} size={40} radius={10} color={shopColor(s.name)} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "#1d1d1f" }}>{s.name}</div>
                  {s.cashback && <div style={{ fontSize: 13, color: "#16A34A", fontWeight: 600 }}>Cashback {s.cashback}</div>}
                </div>
                <a href={s.affiliate_link || "#"} target="_blank" rel="nofollow noopener noreferrer" style={{ padding: "8px 16px", borderRadius: 8, background: "#22C55E", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
                  Nakúpiť →
                </a>
              </div>
            ))}
          </div>
        )}

        {!loading && data && coupons.length === 0 && cashback.length === 0 && (
          <div style={{ padding: "48px 0", textAlign: "center", color: "#888" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>Žiadne výsledky pre „{q}"</div>
            <div style={{ fontSize: 14, marginTop: 6 }}>Skúste iný dotaz alebo prezrite naše obchody.</div>
            <a href="/obchody" style={{ display: "inline-block", marginTop: 16, padding: "10px 24px", borderRadius: 9, background: "#22C55E", color: "#fff", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
              Všetky obchody →
            </a>
          </div>
        )}
      </div>

      {/* RIGHT: Sidebar */}
      <div className="search-sidebar" style={{ width: 300, flexShrink: 0, display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Kupóny box */}
        {coupons.length > 0 && (
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: "18px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 18 }}>🏷️</span> Možné kupóny a zľavy
            </div>
            {coupons.slice(0, 5).map((c: any, i: number) => (
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

        {/* Letáky box */}
        {letaky.length > 0 && (
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: "18px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 18 }}>🗞️</span> Letáky obchodov
            </div>
            {letaky.map((l: any) => (
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

        {/* Heureka box — always show */}
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: "18px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
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

      <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "#aaa" }}>Načítavam...</div>}>
        <SearchResults />
      </Suspense>

      <Footer />
    </div>
  );
}
