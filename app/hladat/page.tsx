"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import ShopFavicon from "@/components/ShopFavicon";
import { classifyQuery, findShop, getCategoryLabel } from "@/lib/search/queryClassifier";

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

function RevealCode({ code, link }: { code: string; link?: string }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleReveal() {
    if (link) window.open(link, "_blank", "noopener,noreferrer");
    setRevealed(true);
    navigator.clipboard.writeText(code).catch(() => {});
  }

  if (!revealed) {
    return (
      <button
        onClick={handleReveal}
        style={{
          padding: "5px 12px", borderRadius: 6,
          border: "1.5px dashed #22C55E",
          background: "#F0FDF4", color: "#16A34A",
          fontWeight: 700, fontSize: 12, cursor: "pointer",
          fontFamily: "monospace", letterSpacing: 1,
        }}
      >
        ••••••• Zobraziť
      </button>
    );
  }

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
      {copied ? "✓ Skopírované" : code}
    </button>
  );
}

function SearchResults() {
  const params = useSearchParams();
  const router = useRouter();
  const q = params.get("q") ?? "";
  const [coupons, setCoupons] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loadingCoupons, setLoadingCoupons] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  const queryType = q ? classifyQuery(q) : "product";
  const categoryLabel = q ? getCategoryLabel(q) : null;

  // Shop query → redirect to /kupony/[slug]
  useEffect(() => {
    if (!q) return;
    if (queryType === "shop") {
      const shop = findShop(q);
      if (shop) {
        setRedirecting(true);
        router.replace(`/kupony/${shop.slug}`);
      }
    }
  }, [q, queryType, router]);

  useEffect(() => {
    if (!q || queryType === "shop") return;
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
  }, [q, queryType]);

  if (redirecting || queryType === "shop") {
    return (
      <div style={{ padding: "80px 24px", textAlign: "center", color: "#888" }}>
        <div style={{ fontSize: 14 }}>Presmerovávam na stránku obchodu...</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px 64px" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media(max-width: 768px) {
          .hl-main { flex-direction: column !important; }
          .hl-sidebar { width: 100% !important; }
        }
        .product-card:hover { border-color: #22C55E !important; box-shadow: 0 4px 20px rgba(34,197,94,0.10) !important; }
        .line-clamp { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      `}</style>

      <div className="hl-main" style={{ display: "flex", gap: 28, alignItems: "flex-start" }}>

        {/* LEFT: Product results (70%) */}
        <div style={{ flex: "0 0 68%", minWidth: 0 }}>
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px", color: "#1d1d1f" }}>
              {categoryLabel
                ? <>{categoryLabel} <span style={{ color: "#22C55E" }}>v akcii</span></>
                : <>Výsledky pre: <span style={{ color: "#22C55E" }}>{q}</span></>
              }
            </h1>
            <div style={{ fontSize: 13, color: "#888" }}>
              {categoryLabel
                ? `Produkty z partnerských obchodov — kategória: ${categoryLabel}`
                : "Produkty z partnerských obchodov"
              }
            </div>
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
              <ShopFavicon domain={p.domain || ""} name={p.domain || ""} size={48} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <a
                  href={p.url}
                  target="_blank"
                  rel="nofollow noopener noreferrer"
                  style={{ fontWeight: 600, fontSize: 15, color: "#1d1d1f", textDecoration: "none", display: "block", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  {p.name}
                </a>
                <div style={{ fontSize: 12, color: "#aaa", marginBottom: 6 }}>{p.domain}</div>
                {p.description && (
                  <div className="line-clamp" style={{ fontSize: 13, color: "#555", lineHeight: 1.5, marginBottom: 10 }}>
                    {p.description}
                  </div>
                )}
                <a
                  href={p.affiliateUrl || p.url}
                  target="_blank"
                  rel="nofollow noopener noreferrer"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "8px 18px", borderRadius: 8,
                    background: "#22C55E", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none",
                  }}
                >
                  Otvoriť v obchode ↗
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

        {/* RIGHT: Sidebar (30%) */}
        <div className="hl-sidebar" style={{ width: 300, flexShrink: 0, display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Kupóny box */}
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: "18px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
              <span>🏷️</span> Možné kupóny
            </div>
            {loadingCoupons && (
              <div style={{ color: "#aaa", fontSize: 13, textAlign: "center", padding: "12px 0" }}>Načítavam...</div>
            )}
            {!loadingCoupons && coupons.length === 0 && (
              <div style={{ color: "#aaa", fontSize: 13, textAlign: "center", padding: "8px 0" }}>Žiadne kupóny nenájdené</div>
            )}
            {coupons.slice(0, 5).map((c: any, i: number) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4, padding: "10px 0", borderBottom: i < Math.min(coupons.length, 5) - 1 ? "1px solid #f5f5f5" : "none" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#1d1d1f", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.title?.length > 45 ? c.title.slice(0, 45) + "…" : c.title}
                </div>
                <div style={{ fontSize: 11, color: "#aaa" }}>{c.shopName ?? c.campaign_name}</div>
                {c.code
                  ? <div style={{ marginTop: 2 }}><RevealCode code={c.code} link={c.affiliate_link || c.url} /></div>
                  : c.affiliate_link && (
                    <a href={c.affiliate_link} target="_blank" rel="nofollow noopener noreferrer" style={{ fontSize: 12, color: "#22C55E", textDecoration: "none", fontWeight: 600 }}>
                      Zobraziť akciu ↗
                    </a>
                  )
                }
              </div>
            ))}
            {coupons.length > 0 && (
              <a href={`/kupony/${q.toLowerCase().replace(/\s+/g, "-")}`} style={{ display: "block", marginTop: 10, fontSize: 13, color: "#22C55E", textDecoration: "none", fontWeight: 600 }}>
                Všetky kupóny ›
              </a>
            )}
          </div>

          {/* Akcie box */}
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: "18px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
              <span>🗞️</span> Akcie obchodov
            </div>
            {[
              { name: "Lidl", slug: "lidl", color: "#FFD700", textColor: "#333", letter: "L" },
              { name: "Kaufland", slug: "kaufland", color: "#E8001D", textColor: "#fff", letter: "K" },
              { name: "Tesco", slug: "tesco", color: "#003580", textColor: "#fff", letter: "T" },
              { name: "Billa", slug: "billa", color: "#E8001D", textColor: "#fff", letter: "B" },
            ].map((l) => (
              <a key={l.slug} href={`/letaky/${l.slug}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #f5f5f5", textDecoration: "none" }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: l.color, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: l.textColor, fontWeight: 800, fontSize: 13 }}>
                  {l.letter}
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "#1d1d1f" }}>{l.name}</div>
              </a>
            ))}
            <a href="/letaky" style={{ display: "block", marginTop: 10, fontSize: 13, color: "#22C55E", textDecoration: "none", fontWeight: 600 }}>
              Zobraziť všetky akcie ›
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
              href={`https://www.heureka.sk/?h%5Bfrm%5D%5Bq%5D=${encodeURIComponent(q)}&utm_source=zlavickovo&utm_medium=referral&positionid=71010`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 16px", borderRadius: 10, background: "#22C55E", color: "#fff", fontWeight: 700, fontSize: 14, textDecoration: "none" }}
            >
              🔍 Porovnať na Heureke ↗
            </a>
          </div>
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
