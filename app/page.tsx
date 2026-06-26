import SearchBar from "@/components/SearchBar";
import CouponCard from "@/components/CouponCard";
import AdBanner from "@/components/AdBanner";
import TopCodes from "@/components/TopCodes";
import Footer from "@/components/Footer";
import { getCouponsFeed, getSalesCoupons } from "@/lib/dognet";
import { LETAKY, getExpiryDate, formatDate, isExpiringSoon } from "@/lib/letaky";
import { getLatestPosts, categoryLabel } from "@/lib/blog";
import ThemeToggle from "@/components/ThemeToggle";

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

type Shop = {
  name: string;
  color: string;
  letter: string;
  featured?: boolean;
  featuredDesc?: string;
};

const SHOPS: Shop[] = [
  { name: "Alza",       color: "#0065BD", letter: "A", featured: true,  featuredDesc: "Najväčší slovenský e-shop s elektronikou a spotrebičmi" },
  { name: "Zalando",    color: "#FF6900", letter: "Z", featured: true,  featuredDesc: "Módne oblečenie a obuv z celej Európy" },
  { name: "Shein",      color: "#E8001D", letter: "S" },
  { name: "Mall",       color: "#E31837", letter: "M" },
  { name: "Notino",     color: "#8B1A1A", letter: "N" },
  { name: "Sportisimo", color: "#00A551", letter: "S" },
  { name: "IKEA",       color: "#0058A3", letter: "I" },
  { name: "Dedoles",    color: "#FF4081", letter: "D" },
  { name: "Martinus",   color: "#D32F2F", letter: "M" },
  { name: "About You",  color: "#000000", letter: "A" },
  { name: "Answear",    color: "#FF6B6B", letter: "A" },
  { name: "Dr. Max",    color: "#006A35", letter: "D" },
];

const featured = SHOPS.filter(s => s.featured);
const regular = SHOPS.filter(s => !s.featured);

function shopSlug(name: string) {
  return name.toLowerCase().replace(/ /g, "-");
}

export default async function Home() {
  let feed: any[] = [];
  let sales: any[] = [];
  try { [feed, sales] = await Promise.all([getCouponsFeed(12), getSalesCoupons(6)]); } catch {}
  const latestPosts = getLatestPosts(3);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "'Inter', system-ui, sans-serif", color: "var(--text)" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": "Zlavickovo",
        "url": "https://zlavickovo.sk",
        "potentialAction": {
          "@type": "SearchAction",
          "target": { "@type": "EntryPoint", "urlTemplate": "https://zlavickovo.sk/kupony/{search_term_string}" },
          "query-input": "required name=search_term_string",
        },
      }) }} />
      <style>{`.hide-scroll::-webkit-scrollbar{display:none}`}</style>

      {/* Nav */}
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 48px", height: 56, position: "sticky", top: 0, zIndex: 100,
        background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(0,0,0,0.08)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: "linear-gradient(135deg, #7C3AED, #2563EB)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 14, fontWeight: 800,
          }}>Z</div>
          <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: "-0.3px" }}>Zlavickovo</span>
        </div>
        <div style={{ display: "flex", gap: 28, fontSize: 13, color: "#555" }}>
          <a href="#obchody" style={{ color: "#555", textDecoration: "none" }}>Obchody</a>
          <a href="#zlavy" style={{ color: "#555", textDecoration: "none" }}>Zľavy</a>
          <a href="/letaky" style={{ color: "#555", textDecoration: "none" }}>Letáky</a>
          <a href="/cashback" style={{ color: "#555", textDecoration: "none" }}>Cashback</a>
          <a href="/blog" style={{ color: "#555", textDecoration: "none" }}>Blog</a>
          <a href="/obchody" style={{ color: "#555", textDecoration: "none" }}>Všetky obchody</a>
          <ThemeToggle />
        </div>
      </nav>

      {/* Hero */}
      <div style={{
        textAlign: "center", padding: "100px 24px 80px",
        background: "linear-gradient(180deg, #f5f3ff 0%, #eff6ff 50%, #fff 100%)",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: -100, left: "50%", transform: "translateX(-50%)",
          width: 800, height: 500,
          background: "radial-gradient(ellipse, rgba(124,58,237,0.12) 0%, rgba(37,99,235,0.08) 40%, transparent 70%)",
          pointerEvents: "none",
        }} />
        <div style={{
          display: "inline-block", padding: "6px 16px", borderRadius: 100,
          background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)",
          fontSize: 12, color: "#7C3AED", marginBottom: 28, fontWeight: 600, letterSpacing: "0.3px",
        }}>
          ✦ AI-powered kupónový portál
        </div>
        <h1 style={{
          fontSize: "clamp(36px, 6vw, 72px)", fontWeight: 800,
          letterSpacing: "-2px", lineHeight: 1.05, margin: "0 0 20px", color: "#1d1d1f",
        }}>
          Ušetri na{" "}
          <span style={{ background: "linear-gradient(135deg, #7C3AED 0%, #2563EB 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            každom nákupe
          </span>
        </h1>
        <p style={{ fontSize: 18, color: "#666", maxWidth: 480, margin: "0 auto 48px", lineHeight: 1.6 }}>
          Zadaj obchod alebo produkt a AI nájde aktuálne zľavové kódy za pár sekúnd.
        </p>
        <SearchBar />
        <div style={{ display: "flex", gap: 24, justifyContent: "center", marginTop: 40, fontSize: 13, color: "#999" }}>
          <span>✓ Overené kódy</span>
          <span>✓ Aktualizované denne</span>
          <span>✓ 100% zadarmo</span>
        </div>
      </div>

      {/* Ad banner – header */}
      <div style={{ padding: "32px 24px 0", display: "flex", justifyContent: "center" }}>
        <AdBanner slot="header" />
      </div>

      {/* Trending kódy */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px 0" }}>
        <style>{`.trending-scroll::-webkit-scrollbar{display:none}`}</style>
        <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.5px", margin: "0 0 20px" }}>🔥 Trending kódy</h2>
        <div className="trending-scroll" style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8, scrollbarWidth: "none", msOverflowStyle: "none" }}>
          <TopCodes limit={6} title="" />
        </div>
      </div>

      {/* Featured obchody */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "64px 24px 0" }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.5px", margin: "0 0 24px" }}>Odporúčané obchody</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {featured.map(shop => (
            <a
              key={shop.name}
              href={`/kupony/${shopSlug(shop.name)}`}
              style={{
                display: "flex", flexDirection: "column", justifyContent: "space-between",
                padding: "28px 28px 24px", borderRadius: 20, textDecoration: "none",
                background: `linear-gradient(135deg, ${shop.color}ee 0%, ${shop.color}99 100%)`,
                minHeight: 160, position: "relative", overflow: "hidden",
              }}
            >
              <div style={{
                position: "absolute", top: -30, right: -30,
                width: 120, height: 120, borderRadius: "50%",
                background: "rgba(255,255,255,0.12)",
              }} />
              <div>
                <div style={{
                  width: 52, height: 52, borderRadius: 14,
                  background: "rgba(255,255,255,0.25)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontWeight: 900, fontSize: 22, marginBottom: 14,
                }}>
                  {shop.letter}
                </div>
                <div style={{ color: "#fff", fontWeight: 800, fontSize: 20, marginBottom: 6 }}>{shop.name}</div>
                <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, lineHeight: 1.4 }}>{shop.featuredDesc}</div>
              </div>
              <div style={{
                marginTop: 20, display: "inline-flex", alignItems: "center", gap: 6,
                background: "rgba(255,255,255,0.2)", color: "#fff",
                padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 700,
                backdropFilter: "blur(4px)", alignSelf: "flex-start",
              }}>
                Zobraziť kupóny →
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Populárne obchody */}
      <div id="obchody" style={{ maxWidth: 1100, margin: "0 auto", padding: "64px 24px 0" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 24 }}>
          <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.5px", margin: 0 }}>Populárne obchody</h2>
          <a href="/obchody" style={{ fontSize: 13, color: "#7C3AED", textDecoration: "none" }}>Zobraziť všetky →</a>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
          {regular.map(shop => (
            <a
              key={shop.name}
              href={`/kupony/${shopSlug(shop.name)}`}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                gap: 12, padding: "24px 16px", borderRadius: 16,
                background: "#fff", border: "1px solid #f0f0f0",
                textDecoration: "none", color: "#1d1d1f",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              }}
            >
              <div style={{
                width: 48, height: 48, borderRadius: 12, background: shop.color,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontWeight: 800, fontSize: 20,
                boxShadow: `0 4px 12px ${shop.color}44`,
              }}>
                {shop.letter}
              </div>
              <span style={{ fontSize: 13, fontWeight: 500, color: "#444" }}>{shop.name}</span>
            </a>
          ))}
        </div>
      </div>

      {/* Najnovšie zľavy – horizontálny scroll */}
      <div id="zlavy" style={{ padding: "64px 0 0" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 24 }}>
            <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.5px", margin: 0 }}>Najnovšie zľavy</h2>
          </div>
        </div>
        <div
          className="hide-scroll"
          style={{
            display: "flex", gap: 16, overflowX: "auto",
            padding: "4px 24px 16px",
            scrollbarWidth: "none", msOverflowStyle: "none",
          }}
        >
          {feed.length > 0 ? feed.map((coupon: any) => {
            const token = coupon.code
              ? Buffer.from(`feed:${coupon.code}`).toString("base64")
              : null;
            const { code: _stripped, ...couponData } = coupon;
            return (
              <div key={coupon.id} style={{ minWidth: 280, maxWidth: 280 }}>
                <CouponCard coupon={couponData} token={token} />
              </div>
            );
          }) : (
            <div style={{ padding: "48px 24px", color: "#aaa", fontSize: 15 }}>
              Momentálne žiadne aktívne zľavy.
            </div>
          )}
        </div>
      </div>

      {/* Ad banner – between coupons */}
      <div style={{ padding: "40px 24px 0", display: "flex", justifyContent: "center" }}>
        <AdBanner slot="between-coupons" />
      </div>

      {/* Letáky preview */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "64px 24px 0" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 24 }}>
          <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.5px", margin: 0 }}>Aktuálne letáky</h2>
          <a href="/letaky" style={{ fontSize: 13, color: "#7C3AED", textDecoration: "none" }}>Zobraziť všetky letáky →</a>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
          {LETAKY.filter(l => ["lidl","kaufland","tesco","billa"].includes(l.slug)).map(letak => {
            const expiry = getExpiryDate(letak.newDayOfWeek);
            const soon = isExpiringSoon(expiry);
            return (
              <a key={letak.slug} href={`/letaky/${letak.slug}`} style={{ display: "block", textDecoration: "none", background: "#fff", border: "1px solid #f0f0f0", borderRadius: 14, padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: letak.color, display: "flex", alignItems: "center", justifyContent: "center", color: letak.color === "#FFCC00" ? "#333" : "#fff", fontWeight: 900, fontSize: 16, flexShrink: 0 }}>
                    {letak.letter}
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{letak.name}</span>
                </div>
                <div style={{ fontSize: 12, color: "#aaa", marginBottom: 4 }}>Platný do {formatDate(expiry)}</div>
                {soon && <div style={{ fontSize: 11, color: "#dc2626", fontWeight: 600 }}>⚠ Expiruje čoskoro!</div>}
              </a>
            );
          })}
        </div>
      </div>

      {/* Najväčšie akcie */}
      {sales.length > 0 && (
        <div style={{ background: "#fafafa", padding: "64px 24px", marginTop: 48 }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.5px", margin: "0 0 24px" }}>Najväčšie akcie</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
              {sales.map((coupon: any) => {
                const token = coupon.code
                  ? Buffer.from(`sales:${coupon.code}`).toString("base64")
                  : null;
                const { code: _stripped, ...couponData } = coupon;
                return <CouponCard key={coupon.id} coupon={couponData} token={token} />;
              })}
            </div>
          </div>
        </div>
      )}

      {/* Blog preview */}
      {latestPosts.length > 0 && (
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "64px 24px 0" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 24 }}>
            <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.5px", margin: 0 }}>Z blogu</h2>
            <a href="/blog" style={{ fontSize: 13, color: "#7C3AED", textDecoration: "none" }}>Všetky články →</a>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
            {latestPosts.map(post => (
              <a key={post.slug} href={`/blog/${post.slug}`} style={{ display: "flex", flexDirection: "column", textDecoration: "none", background: "#fff", borderRadius: 16, border: "1px solid #eee", boxShadow: "0 2px 10px rgba(0,0,0,0.05)", overflow: "hidden" }}>
                <div style={{ padding: "20px 20px 14px", flex: 1 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 100, background: "#f0eeff", color: "#7C3AED", display: "inline-block", marginBottom: 10 }}>{categoryLabel(post.category)}</span>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#1d1d1f", lineHeight: 1.4 }}>{post.title}</div>
                </div>
                <div style={{ padding: "8px 20px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "#bbb" }}>{new Date(post.date).toLocaleDateString("sk-SK")}</span>
                  <span style={{ fontSize: 13, color: "#7C3AED", fontWeight: 600 }}>Čítať →</span>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
