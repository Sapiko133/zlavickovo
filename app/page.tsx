import ShopLogo from "@/components/ShopLogo";
import AdBanner from "@/components/AdBanner";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import HeroSearch from "@/components/HeroSearch";
import CouponCard from "@/components/CouponCard";
import HomeCouponSidebar, { type SidebarCoupon } from "@/components/HomeCouponSidebar";
import { getCouponsFeed, getSalesCoupons, getLatestSales, getShops } from "@/lib/dognet";
import { getEhubShops } from "@/lib/ehub";
import { LETAKY, getExpiryDate, formatDate, isExpiringSoon } from "@/lib/letaky";
import { getLatestPosts, categoryLabel } from "@/lib/blog";
import { AFFIAL_COUPONS } from "@/lib/affial-coupons";
import { AFFIAL_SHOPS } from "@/lib/affial-shops";
import type { HeroItem } from "@/components/HeroCarousel";

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
}

const CATEGORIES = [
  { emoji: "💻", label: "Elektronika", href: "/kategoria/elektronika", color: "#0065BD", bg: "#dbeafe" },
  { emoji: "👗", label: "Móda",        href: "/kategoria/moda",        color: "#E8001D", bg: "#fce7f3" },
  { emoji: "💊", label: "Zdravie",     href: "/kategoria/zdravie",     color: "#00A551", bg: "#dcfce7" },
  { emoji: "💄", label: "Krása",       href: "/kategoria/krasa",       color: "#db2777", bg: "#fdf2f8" },
  { emoji: "⚽", label: "Šport",       href: "/kategoria/sport",       color: "#FF6900", bg: "#fed7aa" },
  { emoji: "🏠", label: "Bývanie",     href: "/kategoria/byvanie",     color: "#7C3AED", bg: "#ede9fe" },
  { emoji: "🛒", label: "Potraviny",   href: "/kategoria/potraviny",   color: "#16a34a", bg: "#dcfce7" },
  { emoji: "👶", label: "Deti",        href: "/kategoria/deti",        color: "#f59e0b", bg: "#fef3c7" },
  { emoji: "✈️", label: "Cestovanie",  href: "/kategoria/cestovanie",  color: "#0ea5e9", bg: "#e0f2fe" },
  { emoji: "📚", label: "Knihy",       href: "/kategoria/knihy",       color: "#D32F2F", bg: "#fee2e2" },
];

export default async function Home() {
  let heroItems: HeroItem[] = [];
  let dognetShops: { id: number; name: string; count: number }[] = [];
  let ehubShops: Awaited<ReturnType<typeof getEhubShops>> = [];
  let sales: any[] = [];
  let feed: any[] = [];
  let latestPosts: any[] = [];

  try {
    [heroItems, dognetShops, ehubShops, sales, feed] = await Promise.all([
      getLatestSales(8).then(items =>
        items.map((c: any): HeroItem => ({
          id: c.id,
          shopName: c.campaign?.name || "Obchod",
          title: c.title || c.name || "Akcia",
          discount: (() => { const m = (c.title || c.name || "").match(/(\d+)\s*%/); return m ? `${m[1]}%` : null; })(),
          link: c.affiliate_link || c.url || "#",
          expires: c.valid_to ? new Date(c.valid_to).toLocaleDateString("sk-SK") : null,
        }))
      ),
      getShops().catch(() => []),
      getEhubShops().catch(() => []),
      getSalesCoupons(8).catch(() => []),
      getCouponsFeed(8).catch(() => []),
    ]);
    latestPosts = getLatestPosts(3);
  } catch {
    latestPosts = getLatestPosts(3);
  }

  // Merge shops from all sources — Dognet > eHub > AFFIAL (static fallback)
  const seenShops = new Set<string>();
  const allShops: HomepageShop[] = [];

  for (const s of dognetShops) {
    const key = s.name.toLowerCase().trim();
    if (!seenShops.has(key)) {
      seenShops.add(key);
      allShops.push({ name: s.name, slug: shopSlug(s.name), count: s.count });
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
      allShops.push({ name: s.name, slug, commission: s.commission });
    }
  }

  for (const s of AFFIAL_SHOPS) {
    const key = s.name.toLowerCase().trim();
    if (!seenShops.has(key)) {
      seenShops.add(key);
      const slug = s.domain.replace(/\.(sk|cz|eu|com|net)$/, "").replace(/\./g, "-");
      allShops.push({ name: s.name, slug, commission: s.commission });
    }
  }

  // Build sidebar coupons (right panel): feed coupons with code + Affial static
  const affialShopMap = new Map(AFFIAL_SHOPS.map(s => [s.domain, s]));
  const feedWithCode = feed.filter((c: any) => c.code?.trim());
  const dognetCount = Math.min(feedWithCode.length, 5);

  const sidebarCoupons: SidebarCoupon[] = [
    ...feedWithCode.slice(0, dognetCount).map((c: any) => {
      const m = (c.title || c.name || "").match(/(\d+)\s*%/);
      return {
        shopName: c.campaign?.name || c.name || "Obchod",
        title: c.title || c.name || "",
        discount: m ? `${m[1]}%` : null,
        code: c.code,
        affiliateLink: c.affiliate_link || c.url || "#",
      };
    }),
    ...AFFIAL_COUPONS.slice(0, 8 - dognetCount).map((c) => {
      const shop = affialShopMap.get(c.domain);
      return {
        shopName: c.shop,
        domain: c.domain,
        title: `${c.discount} zľava`,
        discount: c.discount,
        code: c.code,
        affiliateLink: shop?.affiliateUrl ?? `https://${c.domain}`,
      };
    }),
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "system-ui, -apple-system, sans-serif", color: "#1d1d1f" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org", "@type": "WebSite",
        "name": "Zlavickovo", "url": "https://zlavickovo.sk",
        "potentialAction": { "@type": "SearchAction", "target": { "@type": "EntryPoint", "urlTemplate": "https://zlavickovo.sk/kupony/{search_term_string}" }, "query-input": "required name=search_term_string" },
      }) }} />

      <style>{`
        .home-left-panel, .home-right-panel { display: flex; flex-direction: column; }
        .deal-row { transition: background 0.1s; border-radius: 10px; }
        .deal-row:hover { background: #f5f5f7 !important; }
        .shop-card-hp { transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.15s; }
        .shop-card-hp:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.1) !important; border-color: #22C55E !important; }
        .cat-card-hp { transition: transform 0.18s ease, box-shadow 0.18s ease; cursor: pointer; }
        .cat-card-hp:hover { transform: translateY(-4px) scale(1.03); box-shadow: 0 10px 28px rgba(0,0,0,0.10) !important; }
        .coupon-grid-card { transition: transform 0.18s ease, box-shadow 0.18s ease; }
        .coupon-grid-card:hover { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(0,0,0,0.1) !important; }
        .letak-card { transition: transform 0.18s ease, box-shadow 0.18s ease; }
        .letak-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.1) !important; }
        .blog-card-link { transition: transform 0.18s ease, box-shadow 0.18s ease; }
        .blog-card-link:hover { transform: translateY(-3px); box-shadow: 0 10px 28px rgba(0,0,0,0.08) !important; }
        .see-all { font-size: 13px; color: #22C55E; text-decoration: none; font-weight: 600; }
        .see-all:hover { text-decoration: underline; }
        .sec-title { font-size: 16px; font-weight: 700; color: #1d1d1f; margin: 0; }
        @media(max-width: 900px) {
          .home-3col { flex-direction: column !important; }
          .home-left-panel, .home-right-panel { display: none !important; }
          .home-center { width: 100% !important; }
          .shops-grid-hp { grid-template-columns: repeat(3,1fr) !important; }
        }
        @media(max-width: 600px) {
          .shops-grid-hp { grid-template-columns: repeat(2,1fr) !important; }
          .cat-grid-hp { grid-template-columns: repeat(5,1fr) !important; }
          .letaky-grid { grid-template-columns: repeat(2,1fr) !important; }
          .blog-grid { grid-template-columns: 1fr !important; }
          .coupons-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <Nav />
      <HeroSearch />

      {/* ── 3-COLUMN LAYOUT ── */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 20px 0" }}>
        <div className="home-3col" style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>

          {/* LEFT PANEL 20% — Najnovšie akcie (hidden on mobile) */}
          <div className="home-left-panel" style={{ width: 200, flexShrink: 0 }}>
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#1d1d1f", marginBottom: 12 }}>🔥 Najnovšie akcie</div>
              {heroItems.length === 0 ? (
                <div style={{ fontSize: 12, color: "#aaa", textAlign: "center", padding: "16px 0" }}>Žiadne akcie</div>
              ) : heroItems.map((item, i) => (
                <a
                  key={i}
                  href={item.link}
                  target="_blank"
                  rel="nofollow noopener noreferrer"
                  className="deal-row"
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 8,
                    padding: "8px 6px", margin: "0 -6px",
                    textDecoration: "none",
                    borderBottom: i < heroItems.length - 1 ? "1px solid #f0f0f0" : "none",
                  }}
                >
                  <ShopLogo name={item.shopName} size={28} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#1d1d1f", marginBottom: 2 }}>{item.shopName}</div>
                    <div style={{ fontSize: 10, color: "#666", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                      {item.title}
                    </div>
                    {item.discount && (
                      <span style={{ display: "inline-block", marginTop: 3, fontSize: 10, fontWeight: 800, color: "#fff", background: "#F97316", borderRadius: 4, padding: "1px 5px" }}>
                        {item.discount}
                      </span>
                    )}
                  </div>
                </a>
              ))}
              <a href="/letaky" style={{ display: "block", marginTop: 12, textAlign: "center", padding: "7px 10px", borderRadius: 8, background: "#f5f5f7", color: "#22C55E", fontSize: 11, fontWeight: 700, textDecoration: "none" }}>
                Všetky akcie →
              </a>
            </div>
          </div>

          {/* CENTER 60% */}
          <div className="home-center" style={{ flex: 1, minWidth: 0 }}>

            {/* Populárne obchody — Dognet + eHub + AFFIAL */}
            {allShops.length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <h2 className="sec-title">🏪 Populárne obchody</h2>
                  <a href="/obchody" className="see-all">Všetky →</a>
                </div>
                <div className="shops-grid-hp" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
                  {allShops.slice(0, 12).map((shop) => (
                    <a
                      key={shop.slug}
                      href={`/kupony/${shop.slug}`}
                      className="shop-card-hp"
                      style={{
                        display: "flex", flexDirection: "column", alignItems: "center",
                        gap: 8, padding: "14px 10px", borderRadius: 12,
                        background: "#fff", border: "1.5px solid #e8e8e8",
                        textDecoration: "none", boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                      }}
                    >
                      <ShopLogo name={shop.name} size={44} />
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#1d1d1f" }}>{shop.name.length > 12 ? shop.name.slice(0, 12) + "…" : shop.name}</div>
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
              </div>
            )}

            {/* Kategórie */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <h2 className="sec-title">🗂️ Kategórie</h2>
                <a href="/kategoria" className="see-all">Všetky →</a>
              </div>
              <div className="cat-grid-hp" style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8 }}>
                {CATEGORIES.map(cat => (
                  <a
                    key={cat.label}
                    href={cat.href}
                    className="cat-card-hp"
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "center",
                      gap: 8, padding: "16px 8px", borderRadius: 12, textDecoration: "none",
                      background: cat.bg, border: `1px solid ${cat.color}20`,
                      boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                    }}
                  >
                    <span style={{ fontSize: 28, lineHeight: 1 }}>{cat.emoji}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: cat.color, textAlign: "center", lineHeight: 1.3 }}>{cat.label}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT PANEL 20% — Najnovšie kupóny (hidden on mobile) */}
          <div className="home-right-panel" style={{ width: 200, flexShrink: 0 }}>
            <HomeCouponSidebar coupons={sidebarCoupons} />
          </div>
        </div>
      </div>

      {/* ── VÝPREDAJE ── */}
      {sales.length > 0 && (
        <section style={{ marginTop: 40, padding: "40px 0", background: "#fff", borderTop: "1px solid #f0f0f0" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 className="sec-title">🔥 Výpredaje</h2>
            </div>
            <div className="coupons-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(264px,1fr))", gap: 12 }}>
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

      {/* ── AD BANNER ── */}
      <div style={{ padding: "32px 20px 0", display: "flex", justifyContent: "center" }}>
        <AdBanner slot="between-coupons" />
      </div>

      {/* ── LETÁKY ── */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 className="sec-title">🗞️ Aktuálne letáky</h2>
          <a href="/letaky" className="see-all">Zobraziť všetky →</a>
        </div>
        <div className="letaky-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 10 }}>
          {LETAKY.filter(l => ["lidl","kaufland","tesco","billa"].includes(l.slug)).map(letak => {
            const expiry = getExpiryDate(letak.newDayOfWeek);
            const soon = isExpiringSoon(expiry);
            return (
              <a key={letak.slug} href={`/letaky/${letak.slug}`} className="letak-card" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", background: "#fff", border: "1.5px solid #e8e8e8", borderRadius: 12, padding: "14px", boxShadow: "0 2px 6px rgba(0,0,0,0.04)" }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: letak.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: 16, flexShrink: 0 }}>
                  {letak.letter}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#1d1d1f" }}>{letak.name}</div>
                  <div style={{ fontSize: 11, color: soon ? "#dc2626" : "#aaa", marginTop: 2 }}>{soon ? "⚠ " : ""}do {formatDate(expiry)}</div>
                </div>
              </a>
            );
          })}
        </div>
      </section>

      {/* ── BLOG ── */}
      {latestPosts.length > 0 && (
        <section style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 20px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h2 className="sec-title">📝 Z blogu</h2>
            <a href="/blog" className="see-all">Všetky články →</a>
          </div>
          <div className="blog-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 12 }}>
            {latestPosts.map((post: any) => (
              <a key={post.slug} href={`/blog/${post.slug}`} className="blog-card-link" style={{ display: "flex", flexDirection: "column", textDecoration: "none", background: "#fff", borderRadius: 12, border: "1.5px solid #e8e8e8", overflow: "hidden", boxShadow: "0 2px 6px rgba(0,0,0,0.04)" }}>
                <div style={{ padding: "18px 18px 12px", flex: 1 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 100, background: "#f0eeff", color: "#7C3AED", display: "inline-block", marginBottom: 10 }}>{categoryLabel(post.category)}</span>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "#1d1d1f", lineHeight: 1.45 }}>{post.title}</div>
                </div>
                <div style={{ padding: "8px 18px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #f5f5f5" }}>
                  <span style={{ fontSize: 12, color: "#bbb" }}>{new Date(post.date).toLocaleDateString("sk-SK")}</span>
                  <span style={{ fontSize: 13, color: "#7C3AED", fontWeight: 700 }}>Čítať →</span>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      <div style={{ height: 64 }} />
      <Footer />
    </div>
  );
}
