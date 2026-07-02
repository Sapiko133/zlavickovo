import ShopFavicon from "@/components/ShopFavicon";
import { normalizeShopSlug } from "@/lib/slug";
import { getShopDomain } from "@/lib/shop-domains";
import { compareShopsByPriority } from "@/lib/shop-priority";
import AdBanner from "@/components/AdBanner";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import HeroSearch from "@/components/HeroSearch";
import HomeCouponSidebar, { type SidebarCoupon } from "@/components/HomeCouponSidebar";
import { getStaticShops, getStaticEhubShops, getStaticSales, getStaticFeed } from "@/lib/static-data";
import { getLatestPosts, categoryLabel } from "@/lib/blog";
import { AFFIAL_SHOPS } from "@/lib/affial-shops";
import { AFFIAL_COUPONS } from "@/lib/affial-coupons";
import { CATEGORIES_LIST } from "@/lib/categories";
import { getProducts, getCategoryProductCounts, toProductSlug, formatPrice } from "@/lib/heureka/query";
import type { HkProduct } from "@/lib/heureka/types";

export const revalidate = 3600;

export const metadata = {
  title: "Zlavickovo ✂️ Zľavové kódy a kupóny pre slovenské obchody 2026",
  description: "Nájdi aktuálne zľavové kódy pre Alza, Shein, Zalando a 100+ obchodov. AI vyhľadávanie kupónov zadarmo.",
  alternates: { canonical: "https://www.zlavickovo.sk" },
  openGraph: {
    title: "Zlavickovo – Zľavové kódy a kupóny 2026",
    description: "Nájdi aktuálne zľavové kódy pre 100+ slovenských obchodov. AI vyhľadávanie zadarmo.",
    url: "https://www.zlavickovo.sk", type: "website", locale: "sk_SK",
  },
  twitter: {
    card: "summary_large_image",
    title: "Zlavickovo ✂️ Zľavové kódy zadarmo",
    description: "AI vyhľadávanie kupónov pre 100+ slovenských obchodov.",
  },
};

const ORANGE = "#F97316";
const ORANGE_DARK = "#EA580C";
const DARK = "#0F172A";

interface HomepageShop {
  name: string;
  slug: string;
  count?: number;
  commission?: string;
  domain?: string;
}

function ProductCard({ p }: { p: HkProduct }) {
  const pSlug = toProductSlug(p.name, p.id);
  const pPrice = formatPrice(p.price);
  return (
    <a href={`/produkt/${pSlug}`} className="prod-card"
      style={{ display: "flex", flexDirection: "column", background: "#fff", borderRadius: 16, border: "1.5px solid #e8e8e8", textDecoration: "none", color: "#1d1d1f", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
      <div style={{ aspectRatio: "1", background: "#f8f9fa", display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
        {p.img_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.img_url} alt={p.name} loading="lazy" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
        ) : (
          <ShopFavicon domain={p.domain} name={p.domain} size={40} />
        )}
      </div>
      <div style={{ padding: "12px 14px 14px", display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden", marginBottom: 8, minHeight: 36 }}>
          {p.name}
        </div>
        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          {pPrice ? (
            <span style={{ fontSize: 15, fontWeight: 800, color: "#1d1d1f" }}>{pPrice}</span>
          ) : (
            <span style={{ fontSize: 12, color: "#999" }}>Cena na webe</span>
          )}
          <span style={{ fontSize: 12, fontWeight: 700, color: ORANGE, whiteSpace: "nowrap" }}>Detail →</span>
        </div>
        <div style={{ fontSize: 12, color: "#999", marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.domain}</div>
      </div>
    </a>
  );
}

export default async function Home() {
  const dognetShops = getStaticShops();
  const ehubShops = getStaticEhubShops();
  const sales = getStaticSales();
  const feed = getStaticFeed();
  const latestPosts = getLatestPosts(3);

  // Heureka produkty + počty kategórií (DB, chyby ošetrené vo vnútri — vracia prázdne)
  const [{ products, total: productTotal }, categoryCounts] = await Promise.all([
    getProducts(12),
    getCategoryProductCounts(),
  ]);
  const topDeals = products.slice(0, 6);
  const trending = products.slice(6, 12);
  const heroProducts = products.filter(p => p.img_url).slice(0, 3);

  // Merge shops: Dognet > eHub > AFFIAL
  const seenShops = new Set<string>();
  const allShops: HomepageShop[] = [];

  for (const s of dognetShops) {
    const key = s.name.toLowerCase().trim();
    if (!seenShops.has(key)) {
      seenShops.add(key);
      allShops.push({ name: s.name, slug: normalizeShopSlug(s.name), count: s.count || undefined });
    }
  }
  for (const s of ehubShops) {
    if (!s.name) continue;
    const key = s.name.toLowerCase().trim();
    if (!seenShops.has(key)) {
      seenShops.add(key);
      const domain = s.web.replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "");
      const slug = domain ? domain.replace(/\.(sk|cz|eu|com|net|org)$/, "").replace(/\./g, "-") : normalizeShopSlug(s.name);
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
  allShops.sort(compareShopsByPriority);

  // Sidebar kupóny (pravý panel v hero) — max 4
  const affialShopMap = new Map(AFFIAL_SHOPS.map(s => [s.domain, s]));
  const feedWithCode = feed.filter((c: any) => c.code?.trim());
  const dognetCount = Math.min(feedWithCode.length, 3);
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
    ...AFFIAL_COUPONS.slice(0, 4 - dognetCount).map(c => {
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
  ].slice(0, 4);
  sidebarCoupons.sort((a, b) =>
    compareShopsByPriority(
      { name: a.shopName, domain: a.domain },
      { name: b.shopName, domain: b.domain }
    )
  );

  // Štatistiky (reálne dáta)
  const couponCount = feedWithCode.length + AFFIAL_COUPONS.length;
  const akcieCount = sales.length;
  const shopCount = allShops.length;

  // Obľúbené kategórie — tie s produktmi v DB prvé
  const favCategories = [...CATEGORIES_LIST]
    .sort((a, b) => (categoryCounts[b.slug] ?? 0) - (categoryCounts[a.slug] ?? 0))
    .slice(0, 6);

  const TRUST_ITEMS = [
    { emoji: "🔄", title: "Pravidelne aktualizované", desc: "Ponuky a kupóny sa obnovujú automaticky." },
    { emoji: "🛍️", title: "Kupóny a produkty na jednom mieste", desc: "Zľavové kódy, akcie aj produkty prehľadne spolu." },
    { emoji: "🗂️", title: "Prehľadné kategórie", desc: "Elektronika, móda, šport a ďalšie — všetko roztriedené." },
    { emoji: "⚡", title: "Rýchle vyhľadávanie", desc: "Nájdi obchod, produkt alebo kupón na pár klikov." },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff", fontFamily: "system-ui,-apple-system,sans-serif", color: "#1d1d1f" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Organization",
            "@id": "https://www.zlavickovo.sk/#organization",
            "name": "Zlavickovo",
            "url": "https://www.zlavickovo.sk",
            "logo": "https://www.zlavickovo.sk/favicon.ico",
          },
          {
            "@type": "WebSite",
            "@id": "https://www.zlavickovo.sk/#website",
            "name": "Zlavickovo",
            "url": "https://www.zlavickovo.sk",
            "publisher": { "@id": "https://www.zlavickovo.sk/#organization" },
            "potentialAction": {
              "@type": "SearchAction",
              "target": { "@type": "EntryPoint", "urlTemplate": "https://www.zlavickovo.sk/hladat?q={search_term_string}" },
              "query-input": "required name=search_term_string",
            },
          },
        ],
      }) }} />

      <style>{`
        .hero-cta { transition: background .15s, transform .15s; }
        .hero-cta:hover { background: ${ORANGE_DARK} !important; transform: translateY(-1px); }
        .prod-card { transition: transform .18s ease, box-shadow .18s ease, border-color .15s; }
        .prod-card:hover { transform: translateY(-3px); box-shadow: 0 10px 28px rgba(0,0,0,0.10) !important; border-color: ${ORANGE} !important; }
        .shop-card-hp { transition: transform .18s ease, box-shadow .18s ease, border-color .15s; }
        .shop-card-hp:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.10) !important; border-color: ${ORANGE} !important; }
        .cat-tile { transition: transform .15s ease, box-shadow .15s ease; }
        .cat-tile:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(0,0,0,0.08) !important; }
        .fav-cat-card { transition: transform .15s ease, box-shadow .15s ease; }
        .fav-cat-card:hover { transform: translateY(-2px); box-shadow: 0 8px 22px rgba(0,0,0,0.08) !important; }
        .trend-row { transition: background .12s, border-color .12s; }
        .trend-row:hover { background: #fff7ed !important; border-color: ${ORANGE}55 !important; }
        .blog-card-link { transition: transform .18s ease, box-shadow .18s ease; }
        .blog-card-link:hover { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(0,0,0,0.08) !important; }
        .see-all { font-size: 14px; color: ${ORANGE_DARK}; text-decoration: none; font-weight: 700; }
        .see-all:hover { text-decoration: underline; }
        .sec-title { font-size: clamp(20px, 2.6vw, 26px); font-weight: 800; color: #1d1d1f; margin: 0; letter-spacing: -0.4px; }
        .sec-sub { font-size: 14px; color: #6b7280; margin: 6px 0 0; }
        @media(max-width: 960px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .hero-side { max-width: 520px; }
          .prod-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .shops-grid-hp { grid-template-columns: repeat(3, 1fr) !important; }
          .fav-cat-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .trend-grid { grid-template-columns: 1fr !important; }
          .trust-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .stats-grid { grid-template-columns: 1fr !important; }
          .blog-grid { grid-template-columns: 1fr !important; }
        }
        @media(max-width: 560px) {
          .shops-grid-hp { grid-template-columns: repeat(2, 1fr) !important; }
          .trust-grid { grid-template-columns: 1fr !important; }
          .hero-mini-cards { display: none !important; }
        }
      `}</style>

      <Nav />

      {/* ── HERO — tmavý blok + pravý panel kupónov ── */}
      <div style={{ background: `linear-gradient(135deg, ${DARK} 0%, #1E293B 60%, #27364a 100%)`, padding: "48px 20px 56px" }}>
        <div className="hero-grid" style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 340px", gap: 40, alignItems: "start" }}>

          {/* Ľavá časť — text + CTA + search + produktové mini karty */}
          <div>
            <h1 style={{ fontSize: "clamp(30px, 5vw, 48px)", fontWeight: 800, color: "#fff", letterSpacing: "-1.2px", lineHeight: 1.12, margin: "0 0 14px" }}>
              Najlepšie zľavy na jednom mieste
            </h1>
            <p style={{ fontSize: "clamp(15px, 2vw, 19px)", color: "#cbd5e1", margin: "0 0 24px", lineHeight: 1.55, maxWidth: 560 }}>
              Tisíce produktov, stovky obchodov a kupóny, ktoré vám ušetria peniaze.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 28 }}>
              <a href="#najvacsie-zlavy" className="hero-cta"
                style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "15px 28px", borderRadius: 12, background: ORANGE, color: "#fff", fontSize: 16, fontWeight: 800, textDecoration: "none", boxShadow: "0 6px 20px rgba(249,115,22,0.35)" }}>
                Pozrieť najväčšie zľavy ↓
              </a>
              <a href="/kupony"
                style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "15px 28px", borderRadius: 12, background: "rgba(255,255,255,0.08)", border: "1.5px solid rgba(255,255,255,0.25)", color: "#fff", fontSize: 16, fontWeight: 700, textDecoration: "none" }}>
                Všetky kupóny
              </a>
            </div>

            <div style={{ maxWidth: 620 }}>
              <HeroSearch />
            </div>

            {/* Produktové mini karty — reálne obrázky z DB */}
            {heroProducts.length > 0 && (
              <div className="hero-mini-cards" style={{ display: "flex", gap: 12, marginTop: 28, flexWrap: "wrap" }}>
                {heroProducts.map(p => (
                  <a key={p.id} href={`/produkt/${toProductSlug(p.name, p.id)}`}
                    style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.95)", borderRadius: 12, padding: "8px 14px 8px 8px", textDecoration: "none", color: "#1d1d1f", boxShadow: "0 4px 14px rgba(0,0,0,0.25)", maxWidth: 220 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 8, background: "#f8f9fa", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.img_url} alt={p.name} loading="lazy" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: ORANGE_DARK, marginTop: 2 }}>{formatPrice(p.price)}</div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Pravý panel — Najnovšie kupóny (max 4) */}
          <div className="hero-side" style={{ width: "100%" }}>
            <HomeCouponSidebar coupons={sidebarCoupons} />
          </div>
        </div>
      </div>

      {/* ── KATEGÓRIE POD HERO ── */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "36px 20px 0" }}>
        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6, scrollbarWidth: "none" }}>
          {CATEGORIES_LIST.map(cat => (
            <a key={cat.slug} href={`/kategoria/${cat.slug}`} className="cat-tile"
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "16px 18px", borderRadius: 14, background: "#fff", border: "1.5px solid #eceff3", textDecoration: "none", flexShrink: 0, minWidth: 104, boxShadow: "0 2px 6px rgba(0,0,0,0.04)" }}>
              <span style={{ width: 44, height: 44, borderRadius: 12, background: cat.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{cat.emoji}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#1d1d1f", whiteSpace: "nowrap" }}>{cat.label}</span>
            </a>
          ))}
          <a href="/kategoria" className="cat-tile"
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "16px 18px", borderRadius: 14, background: "#fff7ed", border: `1.5px solid ${ORANGE}44`, textDecoration: "none", flexShrink: 0, minWidth: 104 }}>
            <span style={{ width: 44, height: 44, borderRadius: 12, background: ORANGE, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "#fff", fontWeight: 800 }}>→</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: ORANGE_DARK, whiteSpace: "nowrap" }}>Všetky kategórie</span>
          </a>
        </div>
      </section>

      {/* ── NAJVÄČŠIE ZĽAVY DNES ── */}
      {topDeals.length > 0 && (
        <section id="najvacsie-zlavy" style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 20px 0", scrollMarginTop: 80 }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            <div>
              <h2 className="sec-title">🔥 Najväčšie zľavy dnes</h2>
              <p className="sec-sub">Aktuálne ponuky z obchodov — pravidelne aktualizované</p>
            </div>
            <a href="/produkty" className="see-all">Všetky produkty →</a>
          </div>
          <div className="prod-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {topDeals.map(p => <ProductCard key={p.id} p={p} />)}
          </div>
        </section>
      )}

      {/* ── TOP OBCHODY ── */}
      {allShops.length > 0 && (
        <section style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 20px 0" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            <div>
              <h2 className="sec-title">🏪 Top obchody</h2>
              <p className="sec-sub">Známe slovenské a české e-shopy</p>
            </div>
            <a href="/obchody" className="see-all">Všetky obchody →</a>
          </div>
          <div className="shops-grid-hp" style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12 }}>
            {allShops.slice(0, 12).map(shop => (
              <a key={shop.slug} href={`/kupony/${shop.slug}`} className="shop-card-hp"
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "20px 10px 16px", borderRadius: 16, background: "#fff", border: "1.5px solid #eceff3", textDecoration: "none", boxShadow: "0 2px 6px rgba(0,0,0,0.04)" }}>
                <ShopFavicon domain={shop.domain || getShopDomain(shop.name) || ""} name={shop.name} size={44} />
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1d1d1f", lineHeight: 1.3 }}>
                    {shop.name.length > 14 ? shop.name.slice(0, 14) + "…" : shop.name}
                  </div>
                  <div style={{ fontSize: 12, color: ORANGE_DARK, fontWeight: 600, marginTop: 4 }}>Kupóny a akcie</div>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* ── AD BANNER ── */}
      <div style={{ padding: "40px 20px 0", maxWidth: 1200, margin: "0 auto" }}>
        <AdBanner slot="between-coupons" />
      </div>

      {/* ── OBĽÚBENÉ KATEGÓRIE ── */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <div>
            <h2 className="sec-title">⭐ Obľúbené kategórie</h2>
            <p className="sec-sub">Produkty, kupóny a zľavy na jednom mieste</p>
          </div>
          <a href="/kategoria" className="see-all">Všetky kategórie →</a>
        </div>
        <div className="fav-cat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          {favCategories.map(cat => {
            const count = categoryCounts[cat.slug];
            return (
              <a key={cat.slug} href={`/kategoria/${cat.slug}`} className="fav-cat-card"
                style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 20px", borderRadius: 16, background: "#fff", border: "1.5px solid #eceff3", textDecoration: "none", boxShadow: "0 2px 6px rgba(0,0,0,0.04)" }}>
                <span style={{ width: 52, height: 52, borderRadius: 14, background: cat.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>{cat.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#1d1d1f" }}>{cat.label}</div>
                  <div style={{ fontSize: 13, color: "#6b7280", marginTop: 3 }}>
                    {count ? `${count.toLocaleString("sk-SK")} produktov` : "Kupóny a zľavy"}
                  </div>
                </div>
                <span style={{ fontSize: 15, color: cat.color, fontWeight: 800, flexShrink: 0 }}>→</span>
              </a>
            );
          })}
        </div>
      </section>

      {/* ── TRENDUJÚCE PRODUKTY ── */}
      {trending.length > 0 && (
        <section style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 20px 0" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            <div>
              <h2 className="sec-title">📈 Trendujúce produkty</h2>
              <p className="sec-sub">Naposledy pridané do našej databázy</p>
            </div>
            <a href="/produkty" className="see-all">Všetky produkty →</a>
          </div>
          <div className="trend-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
            {trending.map(p => {
              const pSlug = toProductSlug(p.name, p.id);
              const pPrice = formatPrice(p.price);
              return (
                <a key={p.id} href={`/produkt/${pSlug}`} className="trend-row"
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", borderRadius: 14, background: "#fff", border: "1.5px solid #eceff3", textDecoration: "none", color: "#1d1d1f" }}>
                  <div style={{ width: 56, height: 56, borderRadius: 10, background: "#f8f9fa", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0, padding: 4 }}>
                    {p.img_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.img_url} alt={p.name} loading="lazy" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                    ) : (
                      <ShopFavicon domain={p.domain} name={p.domain} size={32} />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: "#999", marginTop: 3 }}>{p.domain}</div>
                  </div>
                  {pPrice && (
                    <span style={{ fontSize: 14, fontWeight: 800, color: "#1d1d1f", whiteSpace: "nowrap", flexShrink: 0 }}>{pPrice}</span>
                  )}
                </a>
              );
            })}
          </div>
        </section>
      )}

      {/* ── DÔVERYHODNOSTNÝ PÁS ── */}
      <section style={{ maxWidth: 1200, margin: "48px auto 0", padding: "0 20px" }}>
        <div className="trust-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, background: "#f8f9fa", borderRadius: 20, padding: "28px 24px", border: "1px solid #eceff3" }}>
          {TRUST_ITEMS.map(item => (
            <div key={item.title} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontSize: 26 }}>{item.emoji}</span>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#1d1d1f", lineHeight: 1.35 }}>{item.title}</div>
              <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── BLOG ── */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <div>
            <h2 className="sec-title">📝 Z blogu</h2>
            <p className="sec-sub">Tipy, ako nakupovať výhodnejšie</p>
          </div>
          <a href="/blog" className="see-all">Všetky články →</a>
        </div>
        {latestPosts.length > 0 ? (
          <div className="blog-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {latestPosts.map((post: any) => (
              <a key={post.slug} href={`/blog/${post.slug}`} className="blog-card-link"
                style={{ display: "flex", flexDirection: "column", textDecoration: "none", background: "#fff", borderRadius: 16, border: "1.5px solid #eceff3", overflow: "hidden", boxShadow: "0 2px 6px rgba(0,0,0,0.04)" }}>
                <div style={{ padding: "20px 20px 14px", flex: 1 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 100, background: "#fff7ed", color: ORANGE_DARK, display: "inline-block", marginBottom: 12 }}>{categoryLabel(post.category)}</span>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#1d1d1f", lineHeight: 1.45 }}>{post.title}</div>
                </div>
                <div style={{ padding: "10px 20px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #f5f5f5" }}>
                  <span style={{ fontSize: 13, color: "#9ca3af" }}>{new Date(post.date).toLocaleDateString("sk-SK")}</span>
                  <span style={{ fontSize: 14, color: ORANGE_DARK, fontWeight: 700 }}>Čítať →</span>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div style={{ padding: "36px", textAlign: "center", color: "#9ca3af", background: "#f8f9fa", borderRadius: 16, border: "1px solid #eceff3", fontSize: 14 }}>
            Články pripravujeme.
          </div>
        )}
      </section>

      {/* ── ŠTATISTIKY + CTA (namiesto newslettera) ── */}
      <section style={{ maxWidth: 1200, margin: "56px auto 0", padding: "0 20px" }}>
        <div style={{ background: `linear-gradient(135deg, ${DARK} 0%, #1E293B 100%)`, borderRadius: 24, padding: "40px 32px", color: "#fff" }}>
          <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 28, alignItems: "center" }}>
            <div>
              <h2 style={{ fontSize: "clamp(20px, 3vw, 28px)", fontWeight: 800, margin: "0 0 8px", letterSpacing: "-0.5px" }}>
                Produkty, kupóny a zľavy na jednom mieste
              </h2>
              <p style={{ fontSize: 15, color: "#cbd5e1", margin: "0 0 24px", lineHeight: 1.5 }}>
                Pravidelne aktualizované ponuky zo slovenských a českých obchodov.
              </p>
              <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
                {[
                  { value: productTotal, label: "produktov" },
                  { value: shopCount, label: "obchodov" },
                  { value: couponCount + akcieCount, label: "kupónov a akcií" },
                ].filter(s => s.value > 0).map(s => (
                  <div key={s.label}>
                    <div style={{ fontSize: "clamp(24px, 3.5vw, 34px)", fontWeight: 800, color: ORANGE }}>{s.value.toLocaleString("sk-SK")}+</div>
                    <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <a href="/kupony" className="hero-cta"
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "15px 30px", borderRadius: 12, background: ORANGE, color: "#fff", fontSize: 16, fontWeight: 800, textDecoration: "none", whiteSpace: "nowrap", boxShadow: "0 6px 20px rgba(249,115,22,0.35)" }}>
                Prezrieť kupóny
              </a>
              <a href="/produkty"
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "15px 30px", borderRadius: 12, background: "rgba(255,255,255,0.08)", border: "1.5px solid rgba(255,255,255,0.25)", color: "#fff", fontSize: 16, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}>
                Prezrieť produkty
              </a>
            </div>
          </div>
        </div>
      </section>

      <div style={{ height: 80 }} />
      <Footer />
    </div>
  );
}
