import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import ShopFavicon from "@/components/ShopFavicon";
import { getShopDomain } from "@/lib/shop-domains";
import { getCoupons } from "@/lib/dognet";
import { getAffialCoupons } from "@/lib/affial";
import { getEhubCoupons } from "@/lib/ehub";
import { inferCategory, CATEGORIES_LIST } from "@/lib/categories";
import type { Metadata } from "next";
import CodeReveal from "./CodeReveal";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Všetky zľavové kódy a kupóny 2026 | Zlavickovo.sk",
  description: "Aktuálne overené zľavové kódy pre 100+ obchodov. Zľavy, akcie a promo kódy zadarmo.",
  alternates: { canonical: "https://www.zlavickovo.sk/kupony" },
  openGraph: {
    title: "Všetky zľavové kódy 2026 – Zlavickovo.sk",
    description: "Aktuálne kupóny pre 100+ slovenských obchodov.",
    url: "https://www.zlavickovo.sk/kupony",
    type: "website",
    locale: "sk_SK",
  },
};

const PER_PAGE = 24;

const SOURCE_COLORS: Record<string, string> = {
  dognet: "#0065BD",
  affial: "#FF6900",
  ehub: "#00A551",
};

const SOURCE_LABELS: Record<string, string> = {
  dognet: "Dognet",
  affial: "Affial",
  ehub: "eHub",
};

const TYPE_LABELS: Record<number, string> = {
  1: "Zľava", 2: "Darček", 3: "Výpredaj", 4: "Iné", 5: "Doprava zdarma",
};

interface UnifiedCoupon {
  id: string;
  shopName: string;
  title: string;
  description: string;
  affiliateLink: string;
  validTo: string | null;
  type: number;
  source: "dognet" | "affial" | "ehub";
  discountPct: number | null;
  hasFreeShipping: boolean;
  category: string;
  token: string | null;
}

function extractDiscount(text: string): number | null {
  const m = text.match(/(\d+)\s*%/);
  return m ? parseInt(m[1]) : null;
}

async function getAllCoupons(): Promise<UnifiedCoupon[]> {
  const [dognetRes, affialRes, ehubRes] = await Promise.allSettled([
    getCoupons(),
    getAffialCoupons(),
    getEhubCoupons(),
  ]);

  const results: UnifiedCoupon[] = [];

  if (dognetRes.status === "fulfilled") {
    for (const c of dognetRes.value) {
      const shopName = c.campaign?.name || c.campaign_name || "";
      const text = c.title || c.name || "";
      results.push({
        id: `dognet-${c.id}`,
        shopName,
        title: text,
        description: c.description || "",
        affiliateLink: c.affiliate_link || c.url || "#",
        validTo: c.valid_to || null,
        type: c.type || 1,
        source: "dognet",
        discountPct: extractDiscount(text),
        hasFreeShipping: c.type === 5 || text.toLowerCase().includes("doprava"),
        category: inferCategory(shopName),
        token: c.code ? Buffer.from(`dognet:${c.code}`).toString("base64") : null,
      });
    }
  }

  if (affialRes.status === "fulfilled") {
    for (const c of affialRes.value) {
      const shopName = c.campaign_name || "";
      const text = c.title || "";
      results.push({
        id: c.id || `affial-rnd-${Math.random()}`,
        shopName,
        title: text,
        description: c.description || "",
        affiliateLink: c.affiliate_link || "#",
        validTo: c.valid_to || null,
        type: 1,
        source: "affial",
        discountPct: extractDiscount(text),
        hasFreeShipping: text.toLowerCase().includes("doprava"),
        category: inferCategory(shopName),
        token: c.code ? Buffer.from(`affial:${c.code}`).toString("base64") : null,
      });
    }
  }

  if (ehubRes.status === "fulfilled") {
    for (const c of ehubRes.value) {
      const shopName = c.campaign_name || "";
      const text = c.title || "";
      results.push({
        id: c.id || `ehub-rnd-${Math.random()}`,
        shopName,
        title: text,
        description: c.description || "",
        affiliateLink: c.affiliate_link || "#",
        validTo: c.valid_to || null,
        type: 1,
        source: "ehub",
        discountPct: extractDiscount(c.discount || text) || extractDiscount(text),
        hasFreeShipping: text.toLowerCase().includes("doprava"),
        category: inferCategory(shopName),
        token: c.code ? Buffer.from(`ehub:${c.code}`).toString("base64") : null,
      });
    }
  }

  return results;
}

export default async function KuponyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").toLowerCase().trim();
  const cat = sp.cat ?? "";
  const sort = sp.sort ?? "newest";
  const page = Math.max(1, parseInt(sp.page ?? "1") || 1);

  let all: UnifiedCoupon[] = [];
  try {
    all = await getAllCoupons();
  } catch {}

  // Filter
  let filtered = all.filter(c => {
    if (q && !c.shopName.toLowerCase().includes(q) && !c.title.toLowerCase().includes(q)) return false;
    if (cat && c.category !== cat) return false;
    return true;
  });

  // Sort
  if (sort === "discount") {
    filtered = [...filtered].sort((a, b) => (b.discountPct ?? -1) - (a.discountPct ?? -1));
  } else if (sort === "code") {
    filtered = filtered.filter(c => c.token !== null);
  }

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  function url(overrides: Record<string, string>) {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (cat) p.set("cat", cat);
    if (sort !== "newest") p.set("sort", sort);
    for (const [k, v] of Object.entries(overrides)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    const s = p.toString();
    return `/kupony${s ? `?${s}` : ""}`;
  }

  const sortOptions = [
    { value: "newest", label: "Najnovšie" },
    { value: "discount", label: "Najväčšia zľava" },
    { value: "code", label: "S kódom" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#f7f8fa", fontFamily: "'Inter', system-ui, sans-serif", color: "#1d1d1f" }}>
      <style>{`
        .coupon-card { transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s; }
        .coupon-card:hover { border-color: #22C55E !important; box-shadow: 0 6px 24px rgba(34,197,94,0.10) !important; transform: translateY(-2px); }
        .filter-tab { transition: background 0.12s, color 0.12s; }
        .filter-tab:hover { background: #f0fdf4 !important; color: #16a34a !important; }
        .sort-btn { transition: background 0.12s, color 0.12s; }
        .sort-btn:hover { background: #f5f5f5 !important; }
        @media(max-width: 900px) {
          .kupony-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media(max-width: 560px) {
          .kupony-grid { grid-template-columns: 1fr !important; }
        }
        .line-clamp2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      `}</style>

      <Nav />

      {/* Page header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e8e8e8", padding: "36px 24px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ fontSize: 12, color: "#aaa", marginBottom: 8 }}>
            <a href="/" style={{ color: "#aaa", textDecoration: "none" }}>Zlavickovo</a>
            {" › "}
            <span style={{ color: "#1d1d1f" }}>Všetky kupóny</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <h1 style={{ fontSize: "clamp(22px, 4vw, 32px)", fontWeight: 800, margin: "0 0 6px", letterSpacing: "-0.5px" }}>
                🎟️ Všetky zľavové kódy a kupóny
              </h1>
              <p style={{ fontSize: 14, color: "#888", margin: 0 }}>
                {total > 0 ? `${total} kupónov` : "Načítavam..."} z Dognet, Affial a eHub partnerov
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e8e8e8", position: "sticky", top: 58, zIndex: 100 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "12px 24px", display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>

          {/* Search */}
          <form method="get" action="/kupony" style={{ display: "flex", gap: 0, flexShrink: 0 }}>
            {cat && <input type="hidden" name="cat" value={cat} />}
            {sort !== "newest" && <input type="hidden" name="sort" value={sort} />}
            <input
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="Hľadaj kód alebo obchod..."
              style={{
                padding: "8px 14px", borderRadius: "9px 0 0 9px",
                border: "1.5px solid #e0e0e0", borderRight: "none",
                background: "#fafafa", fontSize: 16, fontFamily: "inherit",
                outline: "none", width: 220,
              }}
            />
            <button type="submit" style={{
              padding: "8px 12px", borderRadius: "0 9px 9px 0",
              border: "1.5px solid #22C55E", background: "#22C55E",
              color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600,
            }}>
              🔍
            </button>
          </form>

          {/* Sort */}
          <div style={{ display: "flex", gap: 4 }}>
            {sortOptions.map(opt => (
              <a
                key={opt.value}
                href={url({ sort: opt.value, page: "1" })}
                className="sort-btn"
                style={{
                  padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                  textDecoration: "none", whiteSpace: "nowrap",
                  background: sort === opt.value ? "#1d1d1f" : "#f5f5f5",
                  color: sort === opt.value ? "#fff" : "#555",
                }}
              >
                {opt.label}
              </a>
            ))}
          </div>

          {/* Clear filters */}
          {(q || cat || sort !== "newest") && (
            <a href="/kupony" style={{ fontSize: 12, color: "#E8001D", textDecoration: "none", fontWeight: 600, marginLeft: "auto" }}>
              ✕ Zrušiť filtre
            </a>
          )}
        </div>

        {/* Category tabs */}
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 10px", display: "flex", gap: 6, overflowX: "auto" }}>
          <a
            href={url({ cat: "", page: "1" })}
            className="filter-tab"
            style={{
              padding: "5px 13px", borderRadius: 20, fontSize: 12, fontWeight: 600,
              textDecoration: "none", whiteSpace: "nowrap", flexShrink: 0,
              background: !cat ? "#22C55E" : "#f5f5f5",
              color: !cat ? "#fff" : "#555",
            }}
          >
            Všetky
          </a>
          {CATEGORIES_LIST.map(c => (
            <a
              key={c.slug}
              href={url({ cat: c.slug, page: "1" })}
              className="filter-tab"
              style={{
                padding: "5px 13px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                textDecoration: "none", whiteSpace: "nowrap", flexShrink: 0,
                background: cat === c.slug ? "#22C55E" : "#f5f5f5",
                color: cat === c.slug ? "#fff" : "#555",
              }}
            >
              {c.emoji} {c.label}
            </a>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 24px 64px" }}>
        {paginated.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 24px", color: "#aaa" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
            <p style={{ fontSize: 16, fontWeight: 600, margin: "0 0 8px" }}>Žiadne kupóny nenájdené</p>
            <p style={{ fontSize: 14, margin: "0 0 20px" }}>Skúste iný filter alebo vyhľadávanie.</p>
            <a href="/kupony" style={{ color: "#22C55E", fontWeight: 700, textDecoration: "none" }}>
              Zobraziť všetky kupóny
            </a>
          </div>
        ) : (
          <div className="kupony-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {paginated.map(c => {
              const srcColor = SOURCE_COLORS[c.source];
              const expiryStr = c.validTo
                ? new Date(c.validTo).toLocaleDateString("sk-SK", { day: "numeric", month: "numeric", year: "numeric" })
                : null;

              return (
                <div
                  key={c.id}
                  className="coupon-card"
                  style={{
                    background: "#fff", borderRadius: 12,
                    border: "1.5px solid #e5e7eb",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                    display: "flex", flexDirection: "column",
                    overflow: "hidden",
                  }}
                >
                  {/* Card header */}
                  <div style={{ padding: "14px 16px 10px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid #f5f5f5" }}>
                    <ShopFavicon domain={getShopDomain(c.shopName) || ""} name={c.shopName} size={40} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "#1d1d1f", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {c.shopName || "Obchod"}
                      </div>
                      {expiryStr && (
                        <div style={{ fontSize: 11, color: "#aaa", marginTop: 1 }}>
                          Platí do {expiryStr}
                        </div>
                      )}
                    </div>
                    {/* Source badge */}
                    <div style={{
                      fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 5,
                      background: `${srcColor}15`, color: srcColor, flexShrink: 0,
                    }}>
                      {SOURCE_LABELS[c.source]}
                    </div>
                  </div>

                  {/* Card body */}
                  <div style={{ padding: "12px 16px", flex: 1 }}>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
                      {c.discountPct && (
                        <span style={{
                          fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 5,
                          background: "#22C55E", color: "#fff",
                        }}>
                          -{c.discountPct}%
                        </span>
                      )}
                      {c.hasFreeShipping && !c.discountPct && (
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 5,
                          background: "#dbeafe", color: "#1d4ed8",
                        }}>
                          🚚 Doprava zdarma
                        </span>
                      )}
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 5,
                        background: "#F0FDF4", color: "#16A34A",
                      }}>
                        {TYPE_LABELS[c.type] || "Akcia"}
                      </span>
                    </div>
                    <div className="line-clamp2" style={{ fontWeight: 600, fontSize: 13, color: "#1d1d1f", lineHeight: 1.4, marginBottom: 5 }}>
                      {c.title || "Zľava"}
                    </div>
                    {c.description && (
                      <div className="line-clamp2" style={{ fontSize: 12, color: "#888", lineHeight: 1.5 }}>
                        {c.description}
                      </div>
                    )}
                  </div>

                  {/* Card footer */}
                  <div style={{ padding: "10px 16px 14px", borderTop: "1px dashed #f0f0f0" }}>
                    <CodeReveal token={c.token} link={c.affiliateLink} shopName={c.shopName} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 40 }}>
            {currentPage > 1 && (
              <a
                href={url({ page: String(currentPage - 1) })}
                style={{
                  padding: "8px 16px", borderRadius: 9, background: "#fff",
                  border: "1.5px solid #e5e7eb", color: "#444",
                  textDecoration: "none", fontSize: 13, fontWeight: 600,
                }}
              >
                ← Predchádzajúca
              </a>
            )}

            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              let p: number;
              if (totalPages <= 7) {
                p = i + 1;
              } else if (currentPage <= 4) {
                p = i + 1;
              } else if (currentPage >= totalPages - 3) {
                p = totalPages - 6 + i;
              } else {
                p = currentPage - 3 + i;
              }
              return (
                <a
                  key={p}
                  href={url({ page: String(p) })}
                  style={{
                    width: 36, height: 36, borderRadius: 9, display: "flex",
                    alignItems: "center", justifyContent: "center",
                    background: p === currentPage ? "#22C55E" : "#fff",
                    border: `1.5px solid ${p === currentPage ? "#22C55E" : "#e5e7eb"}`,
                    color: p === currentPage ? "#fff" : "#444",
                    textDecoration: "none", fontSize: 13, fontWeight: p === currentPage ? 700 : 500,
                  }}
                >
                  {p}
                </a>
              );
            })}

            {currentPage < totalPages && (
              <a
                href={url({ page: String(currentPage + 1) })}
                style={{
                  padding: "8px 16px", borderRadius: 9, background: "#fff",
                  border: "1.5px solid #e5e7eb", color: "#444",
                  textDecoration: "none", fontSize: 13, fontWeight: 600,
                }}
              >
                Ďalšia →
              </a>
            )}
          </div>
        )}

        {total > 0 && (
          <p style={{ textAlign: "center", fontSize: 12, color: "#bbb", marginTop: 16 }}>
            Strana {currentPage} z {totalPages} · {total} kupónov celkom
          </p>
        )}
      </div>

      <Footer />
    </div>
  );
}
