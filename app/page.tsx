import CouponCard from "@/components/CouponCard";
import AdBanner from "@/components/AdBanner";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import HeroSearch from "@/components/HeroSearch";
import HeroCarousel, { type HeroItem } from "@/components/HeroCarousel";
import { getCouponsFeed, getSalesCoupons, getLatestSales, getCashbackShops, getShops } from "@/lib/dognet";
import { LETAKY, getExpiryDate, formatDate, isExpiringSoon } from "@/lib/letaky";
import { getLatestPosts, categoryLabel } from "@/lib/blog";

export const revalidate = 3600;

export const metadata = {
  title: "Zlavickovo ✂️ Zľavové kódy a kupóny pre slovenské obchody 2026",
  description: "Nájdi aktuálne zľavové kódy pre Alza, Shein, Zalando a 100+ obchodov. AI vyhľadávanie kupónov zadarmo.",
  alternates: { canonical: "https://zlavickovo.sk" },
  openGraph: {
    title: "Zlavickovo – Zľavové kódy a kupóny 2026",
    description: "Nájdi aktuálne zľavové kódy pre 100+ slovenských obchodov. AI vyhľadávanie zadarmo.",
    url: "https://zlavickovo.sk", type: "website", locale: "sk_SK",
  },
  twitter: {
    card: "summary_large_image",
    title: "Zlavickovo ✂️ Zľavové kódy zadarmo",
    description: "AI vyhľadávanie kupónov pre 100+ slovenských obchodov.",
  },
};

const SHOP_COLORS: Record<string, string> = {
  alza: "#0065BD", zalando: "#FF6900", shein: "#E8001D", mall: "#E31837",
  notino: "#8B1A1A", sportisimo: "#00A551", ikea: "#0058A3", dedoles: "#FF4081",
  martinus: "#D32F2F", "about you": "#222", answear: "#FF6B6B", "dr. max": "#006A35",
};
const FALLBACK_COLORS = ["#7C3AED","#0065BD","#E8001D","#00A551","#FF6900","#003580","#D32F2F"];

function shopColor(name: string) {
  const k = name.toLowerCase();
  return SHOP_COLORS[k] ?? FALLBACK_COLORS[name.charCodeAt(0) % FALLBACK_COLORS.length];
}
function shopSlug(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-");
}

const CATEGORIES = [
  { emoji: "💻", label: "Elektronika", href: "/kategoria/elektronika", color: "#0065BD", from: "#dbeafe", to: "#eff6ff" },
  { emoji: "👗", label: "Móda",        href: "/kategoria/moda",        color: "#E8001D", from: "#fce7f3", to: "#fff1f2" },
  { emoji: "💊", label: "Zdravie",     href: "/kategoria/zdravie",     color: "#00A551", from: "#dcfce7", to: "#f0fdf4" },
  { emoji: "💄", label: "Krása",       href: "/kategoria/krasa",       color: "#db2777", from: "#fce7f3", to: "#fdf2f8" },
  { emoji: "⚽", label: "Šport",       href: "/kategoria/sport",       color: "#FF6900", from: "#fed7aa", to: "#fff7ed" },
  { emoji: "🏠", label: "Bývanie",     href: "/kategoria/byvanie",     color: "#7C3AED", from: "#ede9fe", to: "#f5f3ff" },
  { emoji: "🛒", label: "Potraviny",   href: "/kategoria/potraviny",   color: "#16a34a", from: "#dcfce7", to: "#f0fdf4" },
  { emoji: "👶", label: "Deti",        href: "/kategoria/deti",        color: "#f59e0b", from: "#fef3c7", to: "#fffbeb" },
  { emoji: "✈️", label: "Cestovanie",  href: "/kategoria/cestovanie",  color: "#0ea5e9", from: "#e0f2fe", to: "#f0f9ff" },
  { emoji: "📚", label: "Knihy",       href: "/kategoria/knihy",       color: "#D32F2F", from: "#fee2e2", to: "#fff5f5" },
];

export default async function Home() {
  let heroItems: HeroItem[] = [];
  let cashbackShops: any[] = [];
  let popularShops: any[] = [];
  let feed: any[] = [];
  let sales: any[] = [];
  let latestPosts: any[] = [];

  try {
    [heroItems, cashbackShops, popularShops, feed, sales] = await Promise.all([
      getLatestSales(10).then(items =>
        items.map((c: any): HeroItem => ({
          id: c.id,
          shopName: c.campaign?.name || "Obchod",
          title: c.title || c.name || "Akcia",
          discount: (() => { const m = (c.title || c.name || "").match(/(\d+)\s*%/); return m ? `${m[1]}%` : null; })(),
          link: c.affiliate_link || c.url || "#",
          expires: c.valid_to ? new Date(c.valid_to).toLocaleDateString("sk-SK") : null,
        }))
      ),
      getCashbackShops(),
      getShops(),
      getCouponsFeed(12),
      getSalesCoupons(8),
    ]);
    latestPosts = getLatestPosts(3);
  } catch {
    latestPosts = getLatestPosts(3);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#fff", fontFamily: "system-ui, -apple-system, sans-serif", color: "#1d1d1f" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org", "@type": "WebSite",
        "name": "Zlavickovo", "url": "https://zlavickovo.sk",
        "potentialAction": { "@type": "SearchAction", "target": { "@type": "EntryPoint", "urlTemplate": "https://zlavickovo.sk/kupony/{search_term_string}" }, "query-input": "required name=search_term_string" },
      }) }} />

      <style>{`
        /* ── scrollbar ── */
        .hide-scroll::-webkit-scrollbar { display:none; }

        /* ── titles / links ── */
        .sec-title { font-size:18px; font-weight:700; color:#1d1d1f; margin:0; }
        .see-all { font-size:13px; color:#7C3AED; text-decoration:none; font-weight:500; }
        .see-all:hover { text-decoration:underline; }

        /* ── category cards ── */
        .cat-card {
          transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s ease;
          cursor: pointer;
        }
        .cat-card:hover {
          transform: translateY(-6px) scale(1.04);
          box-shadow: 0 16px 40px rgba(0,0,0,0.12) !important;
        }
        .cat-card:hover .cat-emoji { transform: scale(1.15); }
        .cat-emoji { display:inline-block; transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1); }

        /* ── cashback cards ── */
        .cb-card {
          transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s ease;
        }
        .cb-card:hover {
          transform: translateY(-4px) scale(1.03);
          box-shadow: 0 12px 28px rgba(0,0,0,0.12) !important;
        }

        /* ── shop pills ── */
        .shop-pill {
          transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s ease, border-color 0.15s;
        }
        .shop-pill:hover {
          transform: translateY(-4px) scale(1.02);
          box-shadow: 0 10px 28px rgba(124,58,237,0.14) !important;
          border-color: #7C3AED !important;
        }
        .shop-pill:hover .sp-name { color:#7C3AED !important; }

        /* ── coupon cards ── */
        .coupon-grid-card {
          transition: transform 0.18s ease, box-shadow 0.18s ease;
        }
        .coupon-grid-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 32px rgba(0,0,0,0.1) !important;
        }

        /* ── blog cards ── */
        .blog-card-link {
          transition: transform 0.18s ease, box-shadow 0.18s ease;
        }
        .blog-card-link:hover {
          transform: translateY(-3px);
          box-shadow: 0 10px 28px rgba(0,0,0,0.08) !important;
        }

        /* ── letak cards ── */
        .letak-card {
          transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.15s;
        }
        .letak-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.1) !important;
        }

        /* ── responsive ── */
        @media(max-width:900px){
          .cat-grid { grid-template-columns:repeat(5,1fr) !important; }
        }
        @media(max-width:768px){
          .shops-grid { grid-template-columns:repeat(2,1fr) !important; }
          .coupons-grid { grid-template-columns:1fr !important; }
          .letaky-grid { grid-template-columns:repeat(2,1fr) !important; }
          .cat-grid { grid-template-columns:repeat(5,1fr) !important; }
          .section-row { padding-left:16px !important; padding-right:16px !important; }
        }
        @media(max-width:480px){
          .cat-grid { grid-template-columns:repeat(4,1fr) !important; }
          .blog-grid { grid-template-columns:1fr !important; }
          .shops-grid { grid-template-columns:repeat(2,1fr) !important; }
        }
      `}</style>

      <Nav />

      {/* ── HERO ── */}
      <HeroSearch />

      {/* ── HERO CAROUSEL ── */}
      <HeroCarousel items={heroItems} />

      {/* ── AD BANNER ── */}
      <div style={{ padding:"20px 24px 0", display:"flex", justifyContent:"center" }}>
        <AdBanner slot="header" />
      </div>

      {/* ── KATEGÓRIE ── */}
      <section style={{ background:"linear-gradient(135deg,#F0FDF4 0%,#ECFDF5 100%)", padding:"48px 0" }}>
        <div style={{ maxWidth:1100, margin:"0 auto", padding:"0 24px" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
            <h2 className="sec-title">Nakupuj podľa kategórie</h2>
            <a href="/obchody" className="see-all">Všetky obchody →</a>
          </div>
          <div className="cat-grid" style={{ display:"grid", gridTemplateColumns:"repeat(10,1fr)", gap:10 }}>
            {CATEGORIES.map(cat => (
              <a
                key={cat.label}
                href={cat.href}
                className="cat-card"
                style={{
                  display:"flex", flexDirection:"column", alignItems:"center", gap:10,
                  padding:"20px 10px 16px", borderRadius:16, textDecoration:"none",
                  background: `linear-gradient(135deg, ${cat.from} 0%, ${cat.to} 100%)`,
                  border: `1px solid ${cat.color}20`,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                  backdropFilter: "blur(8px)",
                }}
              >
                <span className="cat-emoji" style={{ fontSize:36, lineHeight:1 }}>{cat.emoji}</span>
                <span style={{ fontSize:11, fontWeight:700, color:cat.color, textAlign:"center", lineHeight:1.3 }}>{cat.label}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── CASHBACK OBCHODY ── */}
      {cashbackShops.length > 0 && (
        <section style={{ padding:"48px 0 0" }}>
          <div className="section-row" style={{ maxWidth:1100, margin:"0 auto", padding:"0 24px 16px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <h2 className="sec-title">💰 Cashback obchody</h2>
            <a href="/cashback" className="see-all">Zobraziť všetky →</a>
          </div>
          <div className="hide-scroll" style={{ display:"flex", gap:10, overflowX:"auto", padding:"4px 24px 16px", scrollbarWidth:"none" }}>
            {cashbackShops.slice(0, 16).map((shop: any) => {
              const c = shopColor(shop.name);
              return (
                <a
                  key={shop.id}
                  href={`/kupony/${shop.slug}`}
                  className="cb-card"
                  style={{
                    flexShrink:0, textDecoration:"none",
                    display:"flex", flexDirection:"column", alignItems:"center", gap:8,
                    padding:"16px 18px", minWidth:110, borderRadius:14,
                    background: `linear-gradient(135deg, ${c}12 0%, ${c}06 100%)`,
                    border: `1.5px solid ${c}25`,
                    boxShadow:"0 2px 8px rgba(0,0,0,0.04)",
                  }}
                >
                  <div style={{ width:48, height:48, borderRadius:14, background:c, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:900, fontSize:20, boxShadow:`0 4px 14px ${c}55` }}>
                    {shop.name.charAt(0)}
                  </div>
                  <div style={{ textAlign:"center" }}>
                    <div style={{ fontSize:12, fontWeight:600, color:"#1d1d1f", marginBottom:3 }}>{shop.name.length > 9 ? shop.name.slice(0,9)+"…" : shop.name}</div>
                    {shop.cashback && (
                      <div style={{ fontSize:12, fontWeight:800, color:"#00AA44" }}>
                        {typeof shop.cashback === "number" ? `${shop.cashback}%` : shop.cashback}
                      </div>
                    )}
                  </div>
                </a>
              );
            })}
          </div>
        </section>
      )}

      {/* ── POPULÁRNE OBCHODY ── */}
      {popularShops.length > 0 && (
        <section style={{ maxWidth:1100, margin:"0 auto", padding:"48px 24px 0" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
            <h2 className="sec-title">🏪 Populárne obchody</h2>
            <a href="/obchody" className="see-all">Zobraziť všetky →</a>
          </div>
          <div className="shops-grid" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:10 }}>
            {popularShops.slice(0, 12).map((shop: any) => {
              const c = shopColor(shop.name);
              return (
                <a
                  key={shop.name}
                  href={`/kupony/${shopSlug(shop.name)}`}
                  className="shop-pill"
                  style={{
                    display:"flex", alignItems:"center", gap:12, padding:"14px",
                    borderRadius:12, background:"#fff", border:"1.5px solid #e8e8e8",
                    textDecoration:"none",
                    boxShadow:"0 2px 6px rgba(0,0,0,0.04)",
                  }}
                >
                  <div style={{ width:42, height:42, borderRadius:11, background:c, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:900, fontSize:18, flexShrink:0, boxShadow:`0 4px 12px ${c}44` }}>
                    {shop.name.charAt(0)}
                  </div>
                  <div>
                    <div className="sp-name" style={{ fontSize:13, fontWeight:700, color:"#1d1d1f", transition:"color 0.15s" }}>{shop.name}</div>
                    <div style={{ fontSize:11, color:"#aaa", marginTop:2 }}>
                      {shop.count} {shop.count === 1 ? "kupón" : shop.count < 5 ? "kupóny" : "kupónov"}
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        </section>
      )}

      {/* ── NAJNOVŠIE KUPÓNY ── */}
      <section id="zlavy" style={{ maxWidth:1100, margin:"0 auto", padding:"48px 24px 0" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
          <h2 className="sec-title">🎟️ Najnovšie kupóny</h2>
        </div>
        {feed.length > 0 ? (
          <div className="coupons-grid" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(264px,1fr))", gap:12 }}>
            {feed.map((coupon: any) => {
              const token = coupon.code ? Buffer.from(`feed:${coupon.code}`).toString("base64") : null;
              const { code: _c, ...couponData } = coupon;
              return (
                <div key={coupon.id} className="coupon-grid-card">
                  <CouponCard coupon={couponData} token={token} />
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ color:"#aaa", fontSize:15 }}>Momentálne žiadne aktívne kupóny.</p>
        )}
      </section>

      {/* ── AD BANNER ── */}
      <div style={{ padding:"40px 24px 0", display:"flex", justifyContent:"center" }}>
        <AdBanner slot="between-coupons" />
      </div>

      {/* ── VÝPREDAJE ── */}
      {sales.length > 0 && (
        <section style={{ marginTop:48, padding:"48px 0", background:"linear-gradient(135deg,#fafafa 0%,#f5f5f5 100%)" }}>
          <div style={{ maxWidth:1100, margin:"0 auto", padding:"0 24px" }}>
            <h2 className="sec-title" style={{ marginBottom:16 }}>🔥 Výpredaje</h2>
            <div className="coupons-grid" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(264px,1fr))", gap:12 }}>
              {sales.map((coupon: any) => {
                const token = coupon.code ? Buffer.from(`sales:${coupon.code}`).toString("base64") : null;
                const { code: _c, ...couponData } = coupon;
                return (
                  <div key={coupon.id} className="coupon-grid-card">
                    <CouponCard coupon={couponData} token={token} />
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── LETÁKY ── */}
      <section style={{ maxWidth:1100, margin:"0 auto", padding:"48px 24px 0" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
          <h2 className="sec-title">🗞️ Aktuálne letáky</h2>
          <a href="/letaky" className="see-all">Zobraziť všetky →</a>
        </div>
        <div className="letaky-grid" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))", gap:10 }}>
          {LETAKY.filter(l => ["lidl","kaufland","tesco","billa"].includes(l.slug)).map(letak => {
            const expiry = getExpiryDate(letak.newDayOfWeek);
            const soon = isExpiringSoon(expiry);
            return (
              <a key={letak.slug} href={`/letaky/${letak.slug}`} className="letak-card" style={{ display:"flex", alignItems:"center", gap:12, textDecoration:"none", background:"#fff", border:"1.5px solid #e8e8e8", borderRadius:12, padding:"14px", boxShadow:"0 2px 6px rgba(0,0,0,0.04)" }}>
                <div style={{ width:40, height:40, borderRadius:10, background:letak.color, display:"flex", alignItems:"center", justifyContent:"center", color:letak.color==="FFCC00"?"#333":"#fff", fontWeight:900, fontSize:16, flexShrink:0, boxShadow:`0 3px 10px ${letak.color}55` }}>
                  {letak.letter}
                </div>
                <div>
                  <div style={{ fontWeight:700, fontSize:13, color:"#1d1d1f" }}>{letak.name}</div>
                  <div style={{ fontSize:11, color:soon?"#dc2626":"#aaa", marginTop:2 }}>{soon?"⚠ ":""}do {formatDate(expiry)}</div>
                </div>
              </a>
            );
          })}
        </div>
      </section>

      {/* ── BLOG ── */}
      {latestPosts.length > 0 && (
        <section style={{ maxWidth:1100, margin:"0 auto", padding:"48px 24px 0" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
            <h2 className="sec-title">📝 Z blogu</h2>
            <a href="/blog" className="see-all">Všetky články →</a>
          </div>
          <div className="blog-grid" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:12 }}>
            {latestPosts.map((post: any) => (
              <a key={post.slug} href={`/blog/${post.slug}`} className="blog-card-link" style={{ display:"flex", flexDirection:"column", textDecoration:"none", background:"#fff", borderRadius:12, border:"1.5px solid #e8e8e8", overflow:"hidden", boxShadow:"0 2px 6px rgba(0,0,0,0.04)" }}>
                <div style={{ padding:"18px 18px 12px", flex:1 }}>
                  <span style={{ fontSize:11, fontWeight:700, padding:"2px 9px", borderRadius:100, background:"#f0eeff", color:"#7C3AED", display:"inline-block", marginBottom:10 }}>{categoryLabel(post.category)}</span>
                  <div style={{ fontWeight:600, fontSize:14, color:"#1d1d1f", lineHeight:1.45 }}>{post.title}</div>
                </div>
                <div style={{ padding:"8px 18px 14px", display:"flex", justifyContent:"space-between", alignItems:"center", borderTop:"1px solid #f5f5f5" }}>
                  <span style={{ fontSize:12, color:"#bbb" }}>{new Date(post.date).toLocaleDateString("sk-SK")}</span>
                  <span style={{ fontSize:13, color:"#7C3AED", fontWeight:700 }}>Čítať →</span>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
}
