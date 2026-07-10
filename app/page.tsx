import ShopFavicon from "@/components/ShopFavicon";
import { compareShopsByPriority } from "@/lib/shop-priority";
import AdBanner from "@/components/AdBanner";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import HeroSearch from "@/components/HeroSearch";
import TodayDeals, { type DealItem } from "@/components/TodayDeals";
import TrackedLink from "@/components/TrackedLink";
import { getStaticSales } from "@/lib/static-data";
import { getLatestPosts, categoryLabel } from "@/lib/blog";
import { AFFIAL_SHOPS, buildAffialTrackingUrl } from "@/lib/affial-shops";
import { AFFIAL_COUPONS } from "@/lib/affial-coupons";
import { TAXONOMY, type CategoryId } from "@/lib/taxonomy";
import { getCategoryProductCounts, getProducts, toProductSlug, formatProductPriceLines } from "@/lib/heureka/query";
import type { HkProduct } from "@/lib/heureka/types";
import { buildShopOffersIndex, type ShopOffer } from "@/lib/shop-offers";
import { getSearchStats } from "@/lib/search-log";
import { getClickStats } from "@/lib/click-log";
import { getShopDomain } from "@/lib/shop-domains";
import { buildServerHeurekaUrl } from "@/lib/heureka/affiliate";

export const revalidate = 3600;

export const metadata = {
  title: "Zlavickovo ✂️ Nájdi najvýhodnejší nákup — ceny, kupóny a akcie",
  description: "Vyhľadaj produkt a porovnaj ceny v našich feedoch. Zlavickovo ti ukáže ponuky zoradené podľa ceny a dostupné kupóny a akcie pred nákupom.",
  alternates: { canonical: "https://www.zlavickovo.sk" },
  openGraph: {
    title: "Zlavickovo – Nájdi najvýhodnejší nákup",
    description: "Porovnaj ceny v našich feedoch a nájdi dostupné kupóny pred nákupom.",
    url: "https://www.zlavickovo.sk", type: "website", locale: "sk_SK",
  },
  twitter: {
    card: "summary_large_image",
    title: "Zlavickovo ✂️ Nájdi najvýhodnejší nákup",
    description: "Porovnaj ceny v našich feedoch a nájdi dostupné kupóny pred nákupom.",
  },
};

const ORANGE = "#F97316";
const ORANGE_DARK = "#EA580C";
const DARK = "#0F172A";

// ── Obľúbené obchody — fallback pre "Top obchody" kým nemáme dosť klik dát ──
const FAVOURITE_SHOPS: { name: string; slug: string; domain: string }[] = [
  { name: "Alza", slug: "alza", domain: "alza.sk" },
  { name: "Notino", slug: "notino", domain: "notino.sk" },
  { name: "Datart", slug: "datart", domain: "datart.sk" },
  { name: "Mall", slug: "mall", domain: "mall.sk" },
  { name: "Zalando", slug: "zalando", domain: "zalando.sk" },
  { name: "About You", slug: "about-you", domain: "aboutyou.sk" },
  { name: "Lidl", slug: "lidl", domain: "lidl.sk" },
  { name: "Dr. Max", slug: "dr-max", domain: "drmax.sk" },
  { name: "GymBeam", slug: "gymbeam", domain: "gymbeam.sk" },
  { name: "Decathlon", slug: "decathlon", domain: "decathlon.sk" },
  { name: "Sportisimo", slug: "sportisimo", domain: "sportisimo.sk" },
  { name: "Dedoles", slug: "dedoles", domain: "dedoles.sk" },
];

// ── Populárne kategórie (fixné poradie podľa zadania) ──
const POPULAR_CATEGORY_IDS: CategoryId[] = [
  "elektronika", "moda", "byvanie", "krasa", "sport", "zdravie", "potraviny", "deti",
];

const HOW_STEPS = [
  { emoji: "🔎", title: "Nájdeme produkt", desc: "Zadáš, čo hľadáš, a my prehľadáme produktové feedy aj obchody." },
  { emoji: "💶", title: "Zoradíme ponuky podľa ceny", desc: "Výsledky zobrazíme od najnižšej ceny a zvýrazníme najvýhodnejšiu ponuku." },
  { emoji: "🎟️", title: "Ukážeme dostupné kupóny a akcie", desc: "Pri obchodoch zobrazíme aktívne zľavové kódy a prebiehajúce akcie pred nákupom." },
];

function domainOf(c: any): string {
  return (c.campaign?.url || c.campaign?.website_url || "")
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/\/.*$/, "");
}

function pctOf(txt: string): string | null {
  const m = (txt || "").match(/(\d+)\s*%/);
  return m ? `-${m[1]}%` : null;
}

function parseAffialExpiry(e: string): string | null {
  const m = (e || "").match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
}

// ClickRow.key (shopSlug) → zobraziteľný obchod
function shopFromSlug(slug: string): { slug: string; name: string; domain: string } {
  const name = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return { slug, name, domain: getShopDomain(name) || `${slug}.sk` };
}

export default async function Home() {
  const heurekaHome = buildServerHeurekaUrl();
  const sales = getStaticSales();
  const latestPosts = getLatestPosts(3);
  const categoryCounts = await getCategoryProductCounts().catch(() => ({} as Record<string, number>));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const notExpired = (v?: string | null) => {
    if (!v) return true;
    const d = new Date(v);
    return isNaN(d.getTime()) || d >= today;
  };

  // ── 5. NAJNOVŠIE KUPÓNY — Dognet + Affial kupóny s kódom, jeden obchod raz, max 12 ──
  const dognetKupony: DealItem[] = sales
    .filter((c: any) => c.code?.trim() && (c.affiliate_link || c.url) && notExpired(c.valid_to))
    .map((c: any) => ({
      kind: "kupon" as const,
      shopName: c.campaign?.name || "Obchod",
      domain: domainOf(c),
      title: c.title || c.description || `Zľava v ${c.campaign?.name || "obchode"}`,
      discount: pctOf(c.title || c.description || ""),
      code: c.code,
      affiliateLink: c.affiliate_link || c.url,
      validTo: c.valid_to,
    }));

  const affialShopMap = new Map(AFFIAL_SHOPS.map((s) => [s.domain, s]));
  const affialKupony: DealItem[] = AFFIAL_COUPONS
    .map((c) => ({ ...c, validTo: parseAffialExpiry(c.expires) }))
    .filter((c) => notExpired(c.validTo))
    .map((c) => {
      const shop = affialShopMap.get(c.domain);
      return {
        kind: "kupon" as const,
        shopName: c.shop.replace(/\.(sk|cz|eu|com)$/i, ""),
        domain: c.domain,
        title: `Zľava ${c.discount} na nákup s kódom`,
        discount: c.discount,
        code: c.code,
        affiliateLink: shop?.affiliateUrl ?? buildAffialTrackingUrl(`https://${c.domain}`),
        validTo: c.validTo,
      };
    });

  const byPrio = (arr: DealItem[]) =>
    [...arr].sort((a, b) =>
      compareShopsByPriority({ name: a.shopName, domain: a.domain }, { name: b.shopName, domain: b.domain })
    );
  const newestCoupons: DealItem[] = [];
  const seenCouponShop = new Set<string>();
  for (const c of byPrio([...dognetKupony, ...affialKupony])) {
    const key = c.shopName.toLowerCase().trim();
    if (seenCouponShop.has(key)) continue;
    seenCouponShop.add(key);
    newestCoupons.push(c);
    if (newestCoupons.length >= 12) break;
  }

  // ── 2. TRENDUJÚCE VYHĽADÁVANIA — search logy, top 10 za 7 dní ──
  let trending: { query: string; count: number }[] = [];
  try {
    const s = await getSearchStats(50);
    trending = s.windows.last7d.slice(0, 10).map((r) => ({ query: r.query, count: r.count }));
  } catch {}

  // ── 4. TOP OBCHODY — click tracking, top 12 podľa outbound klikov (fallback: obľúbené) ──
  let topShops: { slug: string; name: string; domain: string }[] = [];
  try {
    const c = await getClickStats();
    topShops = c.windows.last30d.topShops.slice(0, 12).map((r) => shopFromSlug(r.key));
  } catch {}
  if (topShops.length === 0) {
    topShops = FAVOURITE_SHOPS.map((s) => ({ slug: s.slug, name: s.name, domain: s.domain }));
  }

  // ── 3. PRODUKTY S KUPÓNOM — feed-search logika: produkt + kupón/akcia obchodu, max 12 ──
  let productsWithCoupon: { product: HkProduct; offer: ShopOffer }[] = [];
  try {
    const { products } = await getProducts(60, 0);
    const offers = await buildShopOffersIndex(products.map((p) => p.domain));
    for (const p of products) {
      const o = offers.get((p.domain || "").toLowerCase());
      if (o) productsWithCoupon.push({ product: p, offer: o });
      if (productsWithCoupon.length >= 12) break;
    }
  } catch {}

  const popularCategories = POPULAR_CATEGORY_IDS.map((id) => TAXONOMY[id]);

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
        .see-all { font-size: 14px; color: ${ORANGE_DARK}; text-decoration: none; font-weight: 700; }
        .see-all:hover { text-decoration: underline; }
        .sec-title { font-size: clamp(20px, 2.6vw, 26px); font-weight: 800; color: #1d1d1f; margin: 0; letter-spacing: -0.4px; }
        .sec-sub { font-size: 14px; color: #6b7280; margin: 6px 0 0; }
        .shop-card-hp { transition: transform .18s ease, box-shadow .18s ease, border-color .15s; }
        .shop-card-hp:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.10) !important; border-color: ${ORANGE} !important; }
        .cat-tile2 { transition: transform .15s ease, box-shadow .15s ease, border-color .15s; }
        .cat-tile2:hover { transform: translateY(-3px); box-shadow: 0 8px 22px rgba(0,0,0,0.08) !important; border-color: ${ORANGE} !important; }
        .how-card { transition: transform .15s ease, box-shadow .15s ease; }
        .blog-card-link { transition: transform .18s ease, box-shadow .18s ease; }
        .blog-card-link:hover { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(0,0,0,0.08) !important; }
        .trend-pill { transition: transform .12s ease, box-shadow .12s ease, border-color .12s; }
        .trend-pill:hover { transform: translateY(-1px); border-color: ${ORANGE} !important; box-shadow: 0 4px 12px rgba(249,115,22,0.14) !important; color: ${ORANGE_DARK} !important; }
        .prod-coupon-card { transition: transform .15s, box-shadow .15s, border-color .15s; }
        .prod-coupon-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.09) !important; border-color: #22C55E !important; }
        @media(max-width: 960px) {
          .shops-grid-hp { grid-template-columns: repeat(4, 1fr) !important; }
          .cats-grid { grid-template-columns: repeat(3, 1fr) !important; }
          .how-grid { grid-template-columns: 1fr !important; }
          .blog-grid { grid-template-columns: 1fr !important; }
          .explain-grid { grid-template-columns: 1fr !important; }
        }
        @media(max-width: 560px) {
          .shops-grid-hp { grid-template-columns: repeat(3, 1fr) !important; }
          .cats-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>

      <Nav />

      {/* ── 1. HERO — vyhľadávanie úplne hore ── */}
      <div style={{ background: `linear-gradient(135deg, ${DARK} 0%, #1E293B 60%, #27364a 100%)`, padding: "56px 20px 44px" }}>
        <div style={{ maxWidth: 820, margin: "0 auto", textAlign: "center" }}>
          <h1 style={{ fontSize: "clamp(28px, 5vw, 46px)", fontWeight: 800, color: "#fff", letterSpacing: "-1.2px", lineHeight: 1.14, margin: "0 0 16px" }}>
            Nájdite produkt alebo obchod
          </h1>
          <p style={{ fontSize: "clamp(15px, 2vw, 19px)", color: "#cbd5e1", margin: "0 auto 28px", lineHeight: 1.55, maxWidth: 640 }}>
            Vyhľadaj produkt v našich feedoch a skontroluj dostupné kupóny pred nákupom.
          </p>
          <div style={{ maxWidth: 640, margin: "0 auto" }}>
            <HeroSearch
              placeholder="iPhone 16, Dyson, Alza, GymBeam..."
              ctaLabel="Hľadať"
            />
          </div>
        </div>
      </div>

      {/* ── Vysvetlenie pod searchom ── */}
      <section style={{ maxWidth: 1000, margin: "0 auto", padding: "36px 20px 8px" }}>
        <div className="explain-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {[
            { n: "1", t: "Nájdeme produkt vo feedoch a obchodoch" },
            { n: "2", t: "Zoradíme ponuky podľa ceny" },
            { n: "3", t: "Ukážeme dostupné kupóny a akcie" },
          ].map((s) => (
            <div key={s.n} style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", borderRadius: 14, background: "#f8f9fa", border: "1px solid #eceff3" }}>
              <span style={{ width: 34, height: 34, borderRadius: 10, background: ORANGE, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 15, flexShrink: 0 }}>{s.n}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#1d1d1f", lineHeight: 1.35 }}>{s.t}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── 2. TRENDUJÚCE VYHĽADÁVANIA ── */}
      {trending.length > 0 && (
        <section style={{ maxWidth: 1200, margin: "0 auto", padding: "36px 20px 0" }}>
          <div style={{ marginBottom: 16 }}>
            <h2 className="sec-title">🔥 Trendujúce vyhľadávania</h2>
            <p className="sec-sub">Najhľadanejšie výrazy za posledných 7 dní — klikni a pozri ponuky</p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {trending.map((t, i) => (
              <a
                key={t.query}
                href={`/hladat?q=${encodeURIComponent(t.query)}`}
                className="trend-pill"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "10px 16px", borderRadius: 100,
                  background: "#fff", border: "1.5px solid #eceff3",
                  color: "#1d1d1f", fontSize: 14, fontWeight: 700, textDecoration: "none",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 800, color: i < 3 ? ORANGE_DARK : "#9ca3af" }}>{i + 1}.</span>
                {t.query}
              </a>
            ))}
          </div>
        </section>
      )}

      {/* ── 3. PRODUKTY S KUPÓNOM ── */}
      {productsWithCoupon.length > 0 && (
        <section style={{ maxWidth: 1200, margin: "0 auto", padding: "44px 20px 0" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            <div>
              <h2 className="sec-title">🛒 Produkty s kupónom</h2>
              <p className="sec-sub">Produkty, kde má obchod dostupný kupón alebo akciu</p>
            </div>
            <a href="/produkty" className="see-all">Všetky produkty →</a>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
            {productsWithCoupon.map(({ product, offer }) => (
              <ProductCouponCard key={product.id} product={product} offer={offer} />
            ))}
          </div>
        </section>
      )}

      {/* ── 4. TOP OBCHODY ── */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <div>
            <h2 className="sec-title">🏪 Top obchody</h2>
            <p className="sec-sub">Najklikanejšie obchody — pozri dostupné ponuky</p>
          </div>
          <a href="/obchody" className="see-all">Všetky obchody →</a>
        </div>
        <div className="shops-grid-hp" style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12 }}>
          {topShops.map((shop) => (
            <TrackedLink key={shop.slug} href={`/kupony/${shop.slug}`} className="shop-card-hp"
              type="shop_outbound" shopSlug={shop.slug} destinationDomain={shop.domain}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "20px 10px 16px", borderRadius: 16, background: "#fff", border: "1.5px solid #eceff3", textDecoration: "none", boxShadow: "0 2px 6px rgba(0,0,0,0.04)" }}>
              <ShopFavicon domain={shop.domain} name={shop.name} size={44} />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1d1d1f", lineHeight: 1.3 }}>{shop.name}</div>
                <div style={{ fontSize: 12, color: ORANGE_DARK, fontWeight: 600, marginTop: 4 }}>Zobraziť ponuky →</div>
              </div>
            </TrackedLink>
          ))}
        </div>
      </section>

      {/* ── 5. NAJNOVŠIE KUPÓNY ── */}
      {newestCoupons.length > 0 && (
        <section style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 20px 0" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            <div>
              <h2 className="sec-title">🏷️ Najnovšie kupóny</h2>
              <p className="sec-sub">Aktuálne zľavové kódy z obchodov — bez expirovaných ponúk</p>
            </div>
            <a href="/kupony" className="see-all">Všetky kupóny →</a>
          </div>
          <TodayDeals deals={newestCoupons} />
        </section>
      )}

      {/* ── AD BANNER ── */}
      <div style={{ padding: "40px 20px 0", maxWidth: 1200, margin: "0 auto" }}>
        <AdBanner slot="between-coupons" />
      </div>

      {/* ── AKO TO FUNGUJE ── */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 20px 0" }}>
        <div style={{ marginBottom: 20 }}>
          <h2 className="sec-title">💡 Ako to funguje</h2>
          <p className="sec-sub" style={{ maxWidth: 720 }}>
            Zlavickovo kombinuje produktové feedy, kupóny a affiliate ponuky. Výsledky zoradíme podľa ceny a pri obchodoch ukážeme dostupné kupóny a akcie, aby si nakúpil výhodnejšie.
          </p>
        </div>
        <div className="how-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          {HOW_STEPS.map((step) => (
            <div key={step.title} className="how-card" style={{ display: "flex", flexDirection: "column", gap: 8, padding: "22px 22px", borderRadius: 16, background: "#f8f9fa", border: "1px solid #eceff3" }}>
              <span style={{ fontSize: 30 }}>{step.emoji}</span>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#1d1d1f", lineHeight: 1.35 }}>{step.title}</div>
              <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.55 }}>{step.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── POPULÁRNE KATEGÓRIE ── */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <div>
            <h2 className="sec-title">🗂️ Populárne kategórie</h2>
            <p className="sec-sub">Nájdi obchody a kupóny podľa toho, čo hľadáš</p>
          </div>
          <a href="/kategoria" className="see-all">Všetky kategórie →</a>
        </div>
        <div className="cats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          {popularCategories.map((cat) => {
            const count = categoryCounts[cat.id];
            return (
              <a key={cat.id} href={`/kategoria/${cat.id}`} className="cat-tile2"
                style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 18px", borderRadius: 16, background: "#fff", border: "1.5px solid #eceff3", textDecoration: "none", boxShadow: "0 2px 6px rgba(0,0,0,0.04)" }}>
                <span style={{ width: 50, height: 50, borderRadius: 14, background: cat.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>{cat.emoji}</span>
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

      {/* ── 6. HEUREKA FALLBACK BOX — na konci homepage ── */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "56px 20px 0" }}>
        <div style={{
          background: "linear-gradient(135deg, #F0FDF4 0%, #ecfdf5 100%)",
          border: "1.5px solid #bbf7d0", borderRadius: 20,
          padding: "40px 28px", textAlign: "center",
        }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🔍</div>
          <h2 style={{ fontSize: "clamp(20px, 3vw, 26px)", fontWeight: 800, color: "#1d1d1f", margin: "0 0 8px", letterSpacing: "-0.4px" }}>
            Nenašli ste produkt?
          </h2>
          <p style={{ fontSize: 15, color: "#4b5563", lineHeight: 1.6, margin: "0 auto 22px", maxWidth: 480 }}>
            Na Heureke nájdete ponuky od stoviek overených predajcov a porovnáte ceny.
          </p>
          <TrackedLink
            href={heurekaHome}
            target="_blank"
            rel="noopener noreferrer"
            type="heureka_fallback"
            destinationDomain="heureka.sk"
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "15px 32px", borderRadius: 14,
              background: "#22C55E", color: "#fff", fontWeight: 800, fontSize: 16, textDecoration: "none",
              boxShadow: "0 4px 18px rgba(34,197,94,0.30)",
            }}
          >
            Hľadať na Heureke ↗
          </TrackedLink>
        </div>
      </section>

      <div style={{ height: 80 }} />
      <Footer />
    </div>
  );
}

// Produkt s indikáciou dostupného kupónu/akcie obchodu — vedie na detail produktu
function ProductCouponCard({ product, offer }: { product: HkProduct; offer: ShopOffer }) {
  const slug = toProductSlug(product.name, product.id);
  const price = formatProductPriceLines(product);
  const badge = offer.coupon
    ? { label: "🏷️ Kupón", color: "#16A34A", bg: "#F0FDF4", border: "#bbf7d0" }
    : { label: "🔥 Akcia", color: "#EA580C", bg: "#fff7ed", border: "#fed7aa" };

  return (
    <a
      href={`/produkt/${slug}`}
      className="prod-coupon-card"
      style={{
        display: "flex", flexDirection: "column",
        background: "#fff", borderRadius: 14, border: "1.5px solid #e8e8e8",
        textDecoration: "none", color: "#1d1d1f", overflow: "hidden",
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)", position: "relative",
      }}
    >
      {/* Badge kupón/akcia */}
      <span style={{
        position: "absolute", top: 10, left: 10, zIndex: 1,
        fontSize: 11, fontWeight: 800, padding: "3px 9px", borderRadius: 100,
        color: badge.color, background: badge.bg, border: `1px solid ${badge.border}`,
      }}>
        {badge.label}
      </span>

      {/* Obrázok */}
      <div style={{ aspectRatio: "1", background: "#f8f9fa", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {product.img_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.img_url}
            alt={product.name}
            loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "contain", padding: 10 }}
          />
        ) : (
          <ShopFavicon domain={product.domain} name={product.domain} size={48} />
        )}
      </div>

      {/* Info */}
      <div style={{ padding: "12px 14px 14px", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, lineHeight: 1.4, color: "#1d1d1f",
          display: "-webkit-box", WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical" as const, overflow: "hidden",
        }}>
          {product.name}
        </div>
        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {price ? (
            <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.2 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: "#22C55E" }}>{price.primary}</span>
              {price.secondary && (
                <span title="Orientačný prepočet podľa aktuálne nastaveného kurzu." style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                  {price.secondary}
                </span>
              )}
            </span>
          ) : (
            <span style={{ fontSize: 12, color: "#aaa" }}>Cena na webe</span>
          )}
          <span style={{ fontSize: 10, color: "#bbb" }}>{product.domain}</span>
        </div>
      </div>
    </a>
  );
}
