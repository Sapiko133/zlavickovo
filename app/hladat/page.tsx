"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

const LETAKY_SHOPS = [
  { name: "Lidl",     slug: "lidl",     letter: "L", color: "#FFD700", textColor: "#333" },
  { name: "Kaufland", slug: "kaufland", letter: "K", color: "#E8001D", textColor: "#fff" },
  { name: "Tesco",    slug: "tesco",    letter: "T", color: "#003580", textColor: "#fff" },
  { name: "Billa",    slug: "billa",    letter: "B", color: "#E8001D", textColor: "#fff" },
];

function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(code).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      style={{
        padding: "3px 10px", borderRadius: 6,
        border: "1.5px dashed #22C55E",
        background: copied ? "#22C55E" : "#F0FDF4",
        color: copied ? "#fff" : "#16A34A",
        fontWeight: 700, fontSize: 12, cursor: "pointer",
        fontFamily: "monospace", letterSpacing: 1,
      }}
    >
      {copied ? "✓" : code}
    </button>
  );
}

function SearchResults() {
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const [coupons, setCoupons] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loadingCoupons, setLoadingCoupons] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);

  useEffect(() => {
    if (!q) return;
    setLoadingCoupons(true);
    setLoadingProducts(true);
    setCoupons([]);
    setProducts([]);

    fetch("/api/search-v2", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q }),
    })
      .then((r) => r.json())
      .then((d) => { setCoupons(d?.coupons ?? []); setLoadingCoupons(false); })
      .catch(() => setLoadingCoupons(false));

    fetch(`/api/feed-search?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d) => { setProducts(Array.isArray(d) ? d : []); setLoadingProducts(false); })
      .catch(() => setLoadingProducts(false));
  }, [q]);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px 64px", display: "flex", gap: 28, alignItems: "flex-start" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media(max-width: 768px) {
          .hl-wrap { flex-direction: column !important; }
          .hl-sidebar { width: 100% !important; }
        }
        .product-card:hover { border-color: #22C55E !important; box-shadow: 0 4px 20px rgba(34,197,94,0.10) !important; }
        .line-clamp { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      `}</style>

      {/* LEFT: Product results (≈70%) */}
      <div style={{ flex: "0 0 68%", minWidth: 0 }} className="hl-wrap">
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px", color: "#1d1d1f" }}>
            Výsledky pre: <span style={{ color: "#22C55E" }}>{q}</span>
          </h1>
          <div style={{ fontSize: 13, color: "#888" }}>Produkty z partnerských obchodov</div>
        </div>

        {loadingProducts && (
          <div style={{ padding: "48px 0", textAlign: "center" }}>
            <div style={{
              width: 32, height: 32, border: "3px solid #f0f0f0", borderTopColor: "#22C55E",
              borderRadius: "50%", margin: "0 auto 12px", animation: "spin 0.8s linear infinite",
            }} />
            <div style={{ color: "#888", fontSize: 14 }}>Hľadám produkty...</div>
          </div>
        )}

        {!loadingProducts && products.length > 0 && products.map((p: any, i: number) => (
          <div
            key={i}
            className="product-card"
            style={{
              background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb",
              padding: "16px 18px", marginBottom: 10,
              display: "flex", gap: 16, alignItems: "flex-start",
              transition: "border-color 0.15s, box-shadow 0.15s",
            }}
          >
            <div style={{
              flexShrink: 0, width: 48, height: 48, borderRadius: 8,
              background: "#f9fafb", border: "1px solid #e5e7eb",
              display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://logo.clearbit.com/${p.domain}`}
                width={40}
                height={40}
                alt={p.domain}
                style={{ borderRadius: 6, objectFit: "contain" }}
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 15, color: "#1d1d1f", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p.name}
              </div>
              <div style={{ fontSize: 12, color: "#aaa", marginBottom: 6 }}>{p.domain}</div>
              {p.description && (
                <div className="line-clamp" style={{ fontSize: 13, color: "#555", lineHeight: 1.5, marginBottom: 10 }}>
                  {p.description}
                </div>
              )}
              <a
                href={p.affiliateUrl}
                target="_blank"
                rel="nofollow noopener noreferrer"
                style={{
                  display: "inline-block", padding: "8px 18px", borderRadius: 8,
                  background: "#22C55E", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none",
                }}
              >
                Otvoriť obchod ↗
              </a>
            </div>

            {p.price && (
              <div style={{ flexShrink: 0, fontWeight: 700, fontSize: 15, color: "#1d1d1f", paddingTop: 2, whiteSpace: "nowrap" }}>
                {p.price}
              </div>
            )}
          </div>
        ))}

        {!loadingProducts && products.length === 0 && q && (
          <div style={{ padding: "48px 0", textAlign: "center", color: "#888" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>Žiadne produkty pre „{q}"</div>
            <div style={{ fontSize: 14, marginTop: 6 }}>Skúste iný dotaz alebo porovnajte cenu na Heureke.</div>
          </div>
        )}
      </div>

      {/* RIGHT: Sidebar (≈30%) */}
      <div className="hl-sidebar" style={{ width: 300, flexShrink: 0, display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Kupóny box */}
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: "18px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
            <span>🏷️</span> Možné kupóny a zľavy
          </div>
          {loadingCoupons && (
            <div style={{ color: "#aaa", fontSize: 13, textAlign: "center", padding: "12px 0" }}>Načítavam...</div>
          )}
          {!loadingCoupons && coupons.length === 0 && (
            <div style={{ color: "#aaa", fontSize: 13, textAlign: "center", padding: "8px 0" }}>Žiadne kupóny nenájdené</div>
          )}
          {coupons.slice(0, 5).map((c: any, i: number) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4, padding: "10px 0", borderBottom: "1px solid #f5f5f5" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#1d1d1f", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {c.title?.length > 45 ? c.title.slice(0, 45) + "…" : c.title}
              </div>
              <div style={{ fontSize: 11, color: "#aaa" }}>{c.shopName ?? c.campaign_name}</div>
              {c.code && <div style={{ marginTop: 2 }}><CopyCode code={c.code} /></div>}
            </div>
          ))}
          {coupons.length > 0 && (
            <a href={`/kupony/${q.toLowerCase().replace(/\s+/g, "-")}`} style={{ display: "block", marginTop: 10, fontSize: 13, color: "#22C55E", textDecoration: "none", fontWeight: 600 }}>
              Zobraziť všetky kupóny ›
            </a>
          )}
        </div>

        {/* Letáky box */}
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: "18px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
            <span>🗞️</span> Letáky obchodov
          </div>
          {LETAKY_SHOPS.map((l) => (
            <a key={l.slug} href={`/letaky/${l.slug}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #f5f5f5", textDecoration: "none" }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: l.color, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: l.textColor, fontWeight: 800, fontSize: 13 }}>
                {l.letter}
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#1d1d1f" }}>{l.name} leták</div>
            </a>
          ))}
          <a href="/letaky" style={{ display: "block", marginTop: 10, fontSize: 13, color: "#22C55E", textDecoration: "none", fontWeight: 600 }}>
            Zobraziť všetky letáky ›
          </a>
        </div>

        {/* Heureka box */}
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: "18px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <span>🔍</span> Porovnajte cenu na Heureke
          </div>
          <p style={{ fontSize: 13, color: "#666", margin: "0 0 14px", lineHeight: 1.5 }}>
            Nájdite najlepšie ceny od overených predajcov.
          </p>
          <a
            href={`https://www.heureka.sk/?h%5Bfrm%5D%5Bq%5D=${encodeURIComponent(q)}`}
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
