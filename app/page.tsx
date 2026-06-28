import ShopFavicon from "@/components/ShopFavicon";
import { getShopDomain } from "@/lib/shop-domains";
import AdBanner from "@/components/AdBanner";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import DealsCarousel from "@/components/DealsCarousel";
import CouponCard from "@/components/CouponCard";
import { getCouponsFeed, getSalesCoupons, getShops } from "@/lib/dognet";
import { STATIC_AKCIE, dognetCouponToAkcia } from "@/lib/akcie";
import { getEhubShops } from "@/lib/ehub";
import { LETAKY, getExpiryDate, formatDate, isExpiringSoon } from "@/lib/letaky";
import { getLatestPosts, categoryLabel } from "@/lib/blog";
import { AFFIAL_SHOPS } from "@/lib/affial-shops";

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

function shopSlug(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-");
}

interface HomepageShop {
  name: string;
  slug: string;
  count?: number;
  commission?: string;
  domain?: string;
}

const CATEGORIES = [
  { emoji: "💻", label: "Elektronika", href: "/kategoria/elektronika", color: "#0065BD" },
  { emoji: "👗", label: "Móda",        href: "/kategoria/moda",        color: "#E8001D" },
  { emoji: "💊", label: "Zdravie",     href: "/kategoria/zdravie",     color: "#00A551" },
  { emoji: "💄", label: "Krása",       href: "/kategoria/krasa",       color: "#db2777" },
  { emoji: "⚽", label: "Šport",       href: "/kategoria/sport",       color: "#FF6900" },
  { emoji: "🏠", label: "Bývanie",     href: "/kategoria/byvanie",     color: "#7C3AED" },
  { emoji: "🛒", label: "Potraviny",   href: "/kategoria/potraviny",   color: "#16a34a" },
  { emoji: "👶", label: "Deti",        href: "/kategoria/deti",        color: "#f59e0b" },
  { emoji: "✈️", label: "Cestovanie",  href: "/kategoria/cestovanie",  color: "#0ea5e9" },
  { emoji: "📚", label: "Knihy",       href: "/kategoria/knihy",       color: "#D32F2F" },
];

export default async function Home() {
  let dognetShops: { id: number; name: string; count: number }[] = [];
  let ehubShops: Awaited<ReturnType<typeof getEhubShops>> = [];
  let sales: any[] = [];
  let feed: any[] = [];
  let latestPosts: any[] = [];

  try {
    [dognetShops, ehubShops, sales, feed] = await Promise.all([
      getShops().catch(() => []),
      getEhubShops().catch(() => []),
      getSalesCoupons(6).catch(() => []),
      getCouponsFeed(9).catch(() => []),
    ]);
    latestPosts = getLatestPosts(3);
  } catch {
    latestPosts = getLatestPosts(3);
  }

  // Merge shops: Dognet > eHub > AFFIAL
  const seenShops = new Set<string>();
  const allShops: HomepageShop[] = [];

  for (const s of dognetShops) {
    const key = s.name.toLowerCase().trim();
    if (!seenShops.has(key)) {
      seenShops.add(key);
      allShops.push({ name: s.name, slug: shopSlug(s.name), count: s.count || undefined });
    }
  }

  for (const s of ehubShops) {
    if (!s.name) continue;
    const key = s.name.toLowerCase().trim();
    if (!seenShops.has(key)) {
      seenShops.add(key);
      const domain = s.web.replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "");
      const slug = domain
        ? domain.replace(/\.(sk|cz|eu|com|net|org)$/, "").replace(/\./g, "-")
        : shopSlug(s.name);
      allShops.push({ name: s.name, slug, commission: s.commission, domain });
    }
  }

  for (const s of AFFIAL_SHOPS) {
    const key = s.name.toLowerCase().trim();
    if (!seenShops.has(key)) {
      seenShops.add(key);
      const slug = s.domain.replace(/\.(sk|cz|eu|com|net)$/, "").replace(/\./g, "-");
      allShops.push({ name: s.name, slug, commission: s.commission, domain: s.domain });
    }
  }

  // Homepage akcie
  const homepageAkcie = [
    ...sales.filter((c: any) => c.campaign?.name).slice(0, 4).map(dognetCouponToAkcia),
    ...STATIC_AKCIE.slice(0, 8),
  ].slice(0, 8);

  // Coupons for 3-col grid: feed first, then sales
  const allCoupons = [
    ...feed,
    ...sales.filter((s: any) => !feed.some((f: any) => f.id === s.id)),
  ].slice(0, 9);

  return (
    <div style={{ minHeight: "100vh", background: "#f8f9fa", fontFamily: "system-ui, -apple-system, sans-serif", color: "#1d1d1f" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org", "@type": "WebSite",
        "name": "Zlavickovo", "url": "https://zlavickovo.sk",
        "potentialAction": { "@type": "SearchAction", "target": { "@type": "EntryPoint", "urlTemplate": "https://zlavickovo.sk/kupony/{search_term_string}" }, "query-input": "required name=search_term_string" },
      }) }} />

      <style>{`
        .shop-card-hp { transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.15s; }
        .shop-card-hp:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.10) !important; border-color: #22C55E !important; }
        .coupon-grid-card { transition: transform 0.18s ease, box-shadow 0.18s ease; }
        .coupon-grid-card:hover { transform: translateY(-2px); }
        .letak-card { transition: transform 0.18s ease, box-shadow 0.18s ease; }
        .letak-card:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.08) !important; }
        .blog-card-link { transition: transform 0.18s ease, box-shadow 0.18s ease; }
        .blog-card-link:hover { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(0,0,0,0.08) !important; }
        .akcia-card { transition: transform 0.18s ease, box-shadow 0.18s ease; }
        .akcia-card:hover { transform: translateY(-2px); border-color: #22C55E !important; }
        .see-all { font-size: 13px; color: #22C55E; text-decoration: none; font-weight: 600; }
        .see-all:hover { text-decoration: underline; }
        .sec-title { font-size: 20px; font-weight: 800; color: #1d1d1f; margin: 0; letter-spacing: -0.3px; }
        @media(max-width:1200px) { .shops-grid-hp { grid-template-columns: repeat(6,1fr) !important; } }
        @media(max-width:900px) {
          .shops-grid-hp { grid-template-columns: repeat(4,1fr) !important; }
          .coupons-grid { grid-template-columns: repeat(2,1fr) !important; }
          .akcie-grid { grid-template-columns: repeat(2,1fr) !important; }
          .blog-grid { grid-template-columns: 1fr !important; }
        }
        @media(max-width:600px) {
          .shops-grid-hp { grid-template-columns: repeat(2,1fr) !important; }
          .coupons-grid { grid-template-columns: 1fr !important; }
          .akcie-grid { grid-template-columns: 1fr !important; }
          .letaky-grid { grid-template-columns: repeat(2,1fr) !important; }
        }
      `}</style>

      <Nav />

      {/* ── CAROUSEL (full-width, outside container) ── */}
      <DealsCarousel />

      {/* ── POPULÁRNE OBCHODY ── */}
      {allShops.length > 0 && (
        <section style={{ maxWidth: 1300, margin: "0 auto", padding: "36px 20px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <h2 className="sec-title">🏪 Populárne obchody</h2>
            <a href="/obchody" className="see-all">Všetky obchody →</a>
          </div>
          <div className="shops-grid-hp" style={{ display: "grid", gridTemplateColumns: "repeat(8,1fr)", gap: 10 }}>
            {allShops.slice(0, 24).map((shop) => (
              <a
                key={shop.slug}
                href={`/kupony/${shop.slug}`}
                className="shop-card-hp"
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center",
                  gap: 8, padding: "16px 8px 14px", borderRadius: 14,
                  background: "#fff", border: "1.5px solid #e8e8e8",
                  textDecoration: "none", boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                }}
              >
                <ShopFavicon domain={shop.domain || getShopDomain(shop.name) || ""} name={shop.name} size={44} />
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#1d1d1f", lineHeight: 1.3 }}>
                    {shop.name.length > 13 ? shop.name.slice(0, 13) + "…" : shop.name}
                  </div>
                  <div style={{ fontSize: 10, color: "#aaa", marginTop: 2 }}>
                    {shop.count != null
                      ? `${shop.count} kupón${shop.count === 1 ? "" : shop.count < 5 ? "y" : "ov"}`
                      : shop.commission
                      ? `💰 ${shop.commission}`
                      : "kupóny"}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* ── KATEGÓRIE — horizontal scroll pills ── */}
      <section style={{ maxWidth: 1300, margin: "0 auto", padding: "28px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 className="sec-title">🗂️ Kategórie</h2>
          <a href="/kategoria" className="see-all">Všetky →</a>
        </div>
        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
          {CATEGORIES.map(cat => (
            <a
              key={cat.label}
              href={cat.href}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "9px 18px", borderRadius: 100,
                background: "#fff", border: `2px solid ${cat.color}28`,
                color: cat.color, textDecoration: "none", fontWeight: 700, fontSize: 13,
                whiteSpace: "nowrap", flexShrink: 0, boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                transition: "transform 0.15s, box-shadow 0.15s",
              }}
              onMouseEnter={undefined}
            >
              <span style={{ fontSize: 18 }}>{cat.emoji}</span>
              {cat.label}
            </a>
          ))}
        </div>
      </section>

      {/* ── NAJNOVŠIE KUPÓNY — 3 columns ── */}
      {allCoupons.length > 0 && (
        <section style={{ maxWidth: 1300, margin: "0 auto", padding: "36px 20px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <h2 className="sec-title">🎟️ Najnovšie kupóny</h2>
            <a href="/kupony" className="see-all">Všetky kupóny →</a>
          </div>
          <div className="coupons-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
            {allCoupons.map((coupon: any) => {
              const token = coupon.code ? Buffer.from(`home:${coupon.code}`).toString("base64") : null;
              const { code: _c, ...couponData } = coupon;
              return (
                <div key={coupon.id} className="coupon-grid-card">
                  <CouponCard coupon={couponData} token={token} />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── AKCIE ── */}
      {homepageAkcie.length > 0 && (
        <section style={{ maxWidth: 1300, margin: "0 auto", padding: "36px 20px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <h2 className="sec-title">🏷️ Akcie a výhodné ponuky</h2>
            <a href="/akcie" className="see-all">Všetky akcie →</a>
          </div>
          <div className="akcie-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
            {homepageAkcie.map(akcia => (
              <a
                key={akcia.id}
                href={akcia.affiliateUrl}
                target="_blank"
                rel="nofollow noopener noreferrer"
                className="akcia-card"
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  background: "#fff", borderRadius: 14, border: "1.5px solid #e8e8e8",
                  padding: "14px", textDecoration: "none", color: "#1d1d1f",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                }}
              >
                <ShopFavicon domain={akcia.domain || getShopDomain(akcia.shopName) || ""} name={akcia.shopName} size={42} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#1d1d1f", lineHeight: 1.25, marginBottom: 3 }}>
                    {akcia.shopName}
                  </div>
                  <div style={{ fontSize: 11, color: "#555", lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any }}>
                    {akcia.title}
                  </div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 800, color: "#fff", background: "#22C55E", borderRadius: 6, padding: "3px 7px", whiteSpace: "nowrap", flexShrink: 0 }}>
                  {akcia.badge ?? "AKCIA"}
                </span>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* ── AD BANNER ── */}
      <div style={{ padding: "32px 20px 0", maxWidth: 1300, margin: "0 auto" }}>
        <AdBanner slot="between-coupons" />
      </div>

      {/* ── LETÁKY ── */}
      <section style={{ maxWidth: 1300, margin: "0 auto", padding: "36px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 className="sec-title">🗞️ Aktuálne letáky</h2>
          <a href="/letaky" className="see-all">Zobraziť všetky →</a>
        </div>
        <div className="letaky-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 10 }}>
          {LETAKY.filter(l => ["lidl","kaufland","tesco","billa"].includes(l.slug)).map(letak => {
            const expiry = getExpiryDate(letak.newDayOfWeek);
            const soon = isExpiringSoon(expiry);
            return (
              <a key={letak.slug} href={`/letaky/${letak.slug}`} className="letak-card" style={{ display: "flex", alignItems: "center", gap: 14, textDecoration: "none", background: "#fff", border: "1.5px solid #e8e8e8", borderRadius: 14, padding: "16px", boxShadow: "0 2px 6px rgba(0,0,0,0.04)" }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: letak.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: 18, flexShrink: 0 }}>
                  {letak.letter}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#1d1d1f" }}>{letak.name}</div>
                  <div style={{ fontSize: 11, color: soon ? "#dc2626" : "#aaa", marginTop: 3 }}>{soon ? "⚠ " : ""}do {formatDate(expiry)}</div>
                </div>
              </a>
            );
          })}
        </div>
      </section>

      {/* ── BLOG ── */}
      {latestPosts.length > 0 && (
        <section style={{ maxWidth: 1300, margin: "0 auto", padding: "36px 20px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h2 className="sec-title">📝 Z blogu</h2>
            <a href="/blog" className="see-all">Všetky články →</a>
          </div>
          <div className="blog-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 12 }}>
            {latestPosts.map((post: any) => (
              <a key={post.slug} href={`/blog/${post.slug}`} className="blog-card-link" style={{ display: "flex", flexDirection: "column", textDecoration: "none", background: "#fff", borderRadius: 14, border: "1.5px solid #e8e8e8", overflow: "hidden", boxShadow: "0 2px 6px rgba(0,0,0,0.04)" }}>
                <div style={{ padding: "20px 20px 14px", flex: 1 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 100, background: "#f0eeff", color: "#7C3AED", display: "inline-block", marginBottom: 12 }}>{categoryLabel(post.category)}</span>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "#1d1d1f", lineHeight: 1.5 }}>{post.title}</div>
                </div>
                <div style={{ padding: "10px 20px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #f5f5f5" }}>
                  <span style={{ fontSize: 12, color: "#bbb" }}>{new Date(post.date).toLocaleDateString("sk-SK")}</span>
                  <span style={{ fontSize: 13, color: "#7C3AED", fontWeight: 700 }}>Čítať →</span>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      <div style={{ height: 72 }} />
      <Footer />
    </div>
  );
}
