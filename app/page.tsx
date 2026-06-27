import CouponCard from "@/components/CouponCard";
import AdBanner from "@/components/AdBanner";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
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
    url: "https://zlavickovo.sk",
    type: "website",
    locale: "sk_SK",
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
  martinus: "#D32F2F", "about you": "#000", answear: "#FF6B6B", "dr. max": "#006A35",
};
const FALLBACK_COLORS = ["#7C3AED","#0065BD","#E8001D","#00A551","#FF6900","#003580","#D32F2F"];
function shopColor(name: string) {
  const k = name.toLowerCase();
  return SHOP_COLORS[k] ?? FALLBACK_COLORS[name.charCodeAt(0) % FALLBACK_COLORS.length];
}
function shopSlug(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-");
}

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
          discount: (() => {
            const m = (c.title || c.name || "").match(/(\d+)\s*%/);
            return m ? `${m[1]}%` : null;
          })(),
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
        .hide-scroll::-webkit-scrollbar { display: none; }
        .sec-title { font-size: 18px; font-weight: 700; color: #1d1d1f; margin: 0; }
        .see-all { font-size: 13px; color: #7C3AED; text-decoration: none; font-weight: 500; }
        .see-all:hover { text-decoration: underline; }
        .shop-pill:hover { border-color: #7C3AED !important; }
        .shop-pill:hover .sp-name { color: #7C3AED !important; }
        .coupon-grid-card { transition: box-shadow 0.15s; }
        .coupon-grid-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.1) !important; }
        @media(max-width:768px) {
          .shops-grid { grid-template-columns: repeat(2,1fr) !important; }
          .coupons-grid { grid-template-columns: 1fr !important; }
          .letaky-grid { grid-template-columns: repeat(2,1fr) !important; }
          .section-row { padding-left: 16px !important; padding-right: 16px !important; }
        }
        @media(max-width:480px){
          .blog-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <Nav />

      {/* ── HERO CAROUSEL ── */}
      <HeroCarousel items={heroItems} />

      {/* ── AD BANNER ── */}
      <div style={{ padding: "20px 24px 0", display: "flex", justifyContent: "center" }}>
        <AdBanner slot="header" />
      </div>

      {/* ── CASHBACK OBCHODY ── */}
      {cashbackShops.length > 0 && (
        <section style={{ padding: "40px 0 0" }}>
          <div className="section-row" style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 className="sec-title">💰 Cashback obchody</h2>
            <a href="/cashback" className="see-all">Zobraziť všetky →</a>
          </div>
          <div
            className="hide-scroll"
            style={{ display: "flex", gap: 10, overflowX: "auto", padding: "0 24px 12px", scrollbarWidth: "none" }}
          >
            {cashbackShops.slice(0, 16).map((shop: any) => (
              <a
                key={shop.id}
                href={`/kupony/${shop.slug}`}
                style={{ flexShrink: 0, textDecoration: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "16px 20px", background: "#fff", border: "1px solid #e8e8e8", borderRadius: 12, minWidth: 110 }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 12, background: shopColor(shop.name), display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: 18 }}>
                  {shop.name.charAt(0)}
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#1d1d1f", marginBottom: 3 }}>{shop.name.length > 10 ? shop.name.slice(0,10)+"…" : shop.name}</div>
                  {shop.cashback && (
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#00AA44" }}>
                      {typeof shop.cashback === "number" ? `${shop.cashback}%` : shop.cashback} cashback
                    </div>
                  )}
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* ── POPULÁRNE OBCHODY ── */}
      {popularShops.length > 0 && (
        <section style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h2 className="sec-title">🏪 Populárne obchody</h2>
            <a href="/obchody" className="see-all">Zobraziť všetky →</a>
          </div>
          <div className="shops-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))", gap: 10 }}>
            {popularShops.slice(0, 12).map((shop: any) => (
              <a
                key={shop.name}
                href={`/kupony/${shopSlug(shop.name)}`}
                className="shop-pill"
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 14px", borderRadius: 10, background: "#fff", border: "1px solid #e8e8e8", textDecoration: "none", transition: "border-color 0.15s" }}
              >
                <div style={{ width: 40, height: 40, borderRadius: 10, background: shopColor(shop.name), display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 17, flexShrink: 0 }}>
                  {shop.name.charAt(0)}
                </div>
                <div>
                  <div className="sp-name" style={{ fontSize: 13, fontWeight: 600, color: "#1d1d1f", transition: "color 0.15s" }}>{shop.name}</div>
                  <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>{shop.count} {shop.count === 1 ? "kupón" : shop.count < 5 ? "kupóny" : "kupónov"}</div>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* ── NAJNOVŠIE KUPÓNY ── */}
      <section id="zlavy" style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 className="sec-title">🎟️ Najnovšie kupóny</h2>
        </div>
        {feed.length > 0 ? (
          <div className="coupons-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
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
          <p style={{ color: "#aaa", fontSize: 15 }}>Momentálne žiadne aktívne kupóny.</p>
        )}
      </section>

      {/* ── AD BANNER ── */}
      <div style={{ padding: "40px 24px 0", display: "flex", justifyContent: "center" }}>
        <AdBanner slot="between-coupons" />
      </div>

      {/* ── VÝPREDAJE ── */}
      {sales.length > 0 && (
        <section style={{ background: "#fafafa", padding: "40px 0", marginTop: 40 }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
            <h2 className="sec-title" style={{ marginBottom: 16 }}>🔥 Výpredaje</h2>
            <div className="coupons-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
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
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 className="sec-title">🗞️ Aktuálne letáky</h2>
          <a href="/letaky" className="see-all">Zobraziť všetky →</a>
        </div>
        <div className="letaky-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 10 }}>
          {LETAKY.filter(l => ["lidl","kaufland","tesco","billa"].includes(l.slug)).map(letak => {
            const expiry = getExpiryDate(letak.newDayOfWeek);
            const soon = isExpiringSoon(expiry);
            return (
              <a key={letak.slug} href={`/letaky/${letak.slug}`} style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", background: "#fff", border: "1px solid #e8e8e8", borderRadius: 10, padding: "14px" }}>
                <div style={{ width: 38, height: 38, borderRadius: 9, background: letak.color, display: "flex", alignItems: "center", justifyContent: "center", color: letak.color === "#FFCC00" ? "#333" : "#fff", fontWeight: 900, fontSize: 16, flexShrink: 0 }}>
                  {letak.letter}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#1d1d1f" }}>{letak.name}</div>
                  <div style={{ fontSize: 11, color: soon ? "#dc2626" : "#aaa", marginTop: 2 }}>
                    {soon ? "⚠ " : ""}do {formatDate(expiry)}
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      </section>

      {/* ── BLOG ── */}
      {latestPosts.length > 0 && (
        <section style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h2 className="sec-title">📝 Z blogu</h2>
            <a href="/blog" className="see-all">Všetky články →</a>
          </div>
          <div className="blog-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
            {latestPosts.map((post: any) => (
              <a key={post.slug} href={`/blog/${post.slug}`} style={{ display: "flex", flexDirection: "column", textDecoration: "none", background: "#fff", borderRadius: 10, border: "1px solid #e8e8e8", overflow: "hidden" }}>
                <div style={{ padding: "16px 16px 10px", flex: 1 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 100, background: "#f0eeff", color: "#7C3AED", display: "inline-block", marginBottom: 8 }}>{categoryLabel(post.category)}</span>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "#1d1d1f", lineHeight: 1.45 }}>{post.title}</div>
                </div>
                <div style={{ padding: "8px 16px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #f5f5f5" }}>
                  <span style={{ fontSize: 12, color: "#bbb" }}>{new Date(post.date).toLocaleDateString("sk-SK")}</span>
                  <span style={{ fontSize: 13, color: "#7C3AED", fontWeight: 600 }}>Čítať →</span>
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
