import ShopFavicon from "@/components/ShopFavicon";
import { compareShopsByPriority } from "@/lib/shop-priority";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import HeroSearch from "@/components/HeroSearch";
import TrackedLink from "@/components/TrackedLink";
import ArticleCard from "@/components/ArticleCard";
import { latestArticles } from "@/lib/articles";
import { getStaticSales } from "@/lib/static-data";
import { AFFIAL_SHOPS, buildAffialTrackingUrl } from "@/lib/affial-shops";
import { AFFIAL_COUPONS } from "@/lib/affial-coupons";
import { getClickStats } from "@/lib/click-log";
import { getShopDomain } from "@/lib/shop-domains";
import { normalizeShopSlug } from "@/lib/slug";
import { buildServerHeurekaUrl } from "@/lib/heureka/affiliate";

export const revalidate = 3600;

export const metadata = {
  title: "Zlavickovo ✂️ Akcie, výpredaje a kupóny slovenských obchodov",
  description: "Aktuálne výpredaje a akcie obchodov so zľavnenými produktmi, kupóny a tipy na výhodnejší nákup. Nové články pravidelne.",
  alternates: { canonical: "https://www.zlavickovo.sk" },
  openGraph: {
    title: "Zlavickovo – Akcie, výpredaje a kupóny",
    description: "Aktuálne výpredaje obchodov, zľavnené produkty a kupóny na jednom mieste.",
    url: "https://www.zlavickovo.sk", type: "website", locale: "sk_SK",
  },
};

const GREEN = "#22C55E";
const ORANGE_DARK = "#EA580C";
const DARK = "#0F172A";

const FAVOURITE_SHOPS: { name: string; slug: string; domain: string }[] = [
  { name: "Alza", slug: "alza", domain: "alza.sk" },
  { name: "Notino", slug: "notino", domain: "notino.sk" },
  { name: "Datart", slug: "datart", domain: "datart.sk" },
  { name: "Mall", slug: "mall", domain: "mall.sk" },
  { name: "Zalando", slug: "zalando", domain: "zalando.sk" },
  { name: "About You", slug: "about-you", domain: "aboutyou.sk" },
  { name: "Lidl", slug: "lidl", domain: "lidl.sk" },
  { name: "Dr. Max", slug: "dr-max", domain: "drmax.sk" },
];

interface CouponRow {
  shopName: string;
  domain: string;
  shopSlug: string;
  discount: string | null;
}

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
function shopFromSlug(slug: string): { slug: string; name: string; domain: string } {
  const name = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return { slug, name, domain: getShopDomain(name) || `${slug}.sk` };
}

export default async function Home() {
  const heurekaHome = buildServerHeurekaUrl();
  const articles = await latestArticles(12);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const notExpired = (v?: string | null) => {
    if (!v) return true;
    const d = new Date(v);
    return isNaN(d.getTime()) || d >= today;
  };

  // ── TOP KUPÓNY (5) — Dognet + Affial kupóny s kódom, jeden obchod raz ──
  const sales = getStaticSales();
  const dognetKupony: CouponRow[] = sales
    .filter((c: any) => c.code?.trim() && (c.affiliate_link || c.url) && notExpired(c.valid_to))
    .map((c: any) => {
      const shopName = c.campaign?.name || "Obchod";
      return {
        shopName,
        domain: domainOf(c),
        shopSlug: normalizeShopSlug(shopName),
        discount: pctOf(c.title || c.description || ""),
      };
    });

  const affialKupony: CouponRow[] = AFFIAL_COUPONS
    .map((c) => ({ ...c, validTo: parseAffialExpiry(c.expires) }))
    .filter((c) => notExpired(c.validTo))
    .map((c) => {
      const shopName = c.shop.replace(/\.(sk|cz|eu|com)$/i, "");
      return { shopName, domain: c.domain, shopSlug: normalizeShopSlug(c.shop), discount: c.discount };
    });

  const byPrio = (arr: CouponRow[]) =>
    [...arr].sort((a, b) =>
      compareShopsByPriority({ name: a.shopName, domain: a.domain }, { name: b.shopName, domain: b.domain })
    );
  const topCoupons: CouponRow[] = [];
  const seenCoupon = new Set<string>();
  for (const c of byPrio([...dognetKupony, ...affialKupony])) {
    const key = c.shopName.toLowerCase().trim();
    if (seenCoupon.has(key)) continue;
    seenCoupon.add(key);
    topCoupons.push(c);
    if (topCoupons.length >= 5) break;
  }

  // ── POPULÁRNE OBCHODY (8) — click tracking, fallback obľúbené ──
  let topShops: { slug: string; name: string; domain: string }[] = [];
  try {
    const c = await getClickStats();
    topShops = c.windows.last30d.topShops.slice(0, 8).map((r) => shopFromSlug(r.key));
  } catch {}
  if (topShops.length === 0) topShops = FAVOURITE_SHOPS;

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff", fontFamily: "system-ui,-apple-system,sans-serif", color: "#1d1d1f" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [
          { "@type": "Organization", "@id": "https://www.zlavickovo.sk/#organization", name: "Zlavickovo", url: "https://www.zlavickovo.sk", logo: "https://www.zlavickovo.sk/favicon.ico" },
          {
            "@type": "WebSite", "@id": "https://www.zlavickovo.sk/#website", name: "Zlavickovo", url: "https://www.zlavickovo.sk",
            publisher: { "@id": "https://www.zlavickovo.sk/#organization" },
            potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: "https://www.zlavickovo.sk/hladat?q={search_term_string}" }, "query-input": "required name=search_term_string" },
          },
        ],
      }) }} />

      <style>{`
        .sec-title { font-size: clamp(20px, 2.6vw, 26px); font-weight: 800; color: #1d1d1f; margin: 0; letter-spacing: -0.4px; }
        .sec-sub { font-size: 14px; color: #6b7280; margin: 6px 0 0; }
        .see-all { font-size: 14px; color: ${ORANGE_DARK}; text-decoration: none; font-weight: 700; }
        .see-all:hover { text-decoration: underline; }
        .article-card:hover { transform: translateY(-3px); box-shadow: 0 10px 28px rgba(0,0,0,0.10) !important; border-color: ${GREEN} !important; }
        .side-row:hover { background: #F0FDF4 !important; }
        @media(max-width: 900px) {
          .home-layout { grid-template-columns: 1fr !important; }
          .home-sidebar { position: static !important; }
        }
      `}</style>

      <Nav />

      {/* HERO — vyhľadávanie obchodov */}
      <div style={{ background: `linear-gradient(135deg, ${DARK} 0%, #1E293B 60%, #27364a 100%)`, padding: "52px 20px 42px" }}>
        <div style={{ maxWidth: 820, margin: "0 auto", textAlign: "center" }}>
          <h1 style={{ fontSize: "clamp(26px, 5vw, 44px)", fontWeight: 800, color: "#fff", letterSpacing: "-1.2px", lineHeight: 1.14, margin: "0 0 14px" }}>
            Akcie, výpredaje a kupóny obchodov
          </h1>
          <p style={{ fontSize: "clamp(15px, 2vw, 19px)", color: "#cbd5e1", margin: "0 auto 26px", lineHeight: 1.55, maxWidth: 620 }}>
            Nájdi obchod a pozri aktuálne výpredaje, zľavnené produkty a kupóny pred nákupom.
          </p>
          <div style={{ maxWidth: 620, margin: "0 auto" }}>
            <HeroSearch placeholder="Alza, Notino, Zalando, GymBeam..." ctaLabel="Hľadať" />
          </div>
        </div>
      </div>

      {/* HLAVNÝ OBSAH — grid článkov + sidebar */}
      <div className="home-layout" style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 20px 0", display: "grid", gridTemplateColumns: "1fr 300px", gap: 32, alignItems: "start" }}>

        {/* Grid článkov */}
        <main>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            <div>
              <h2 className="sec-title">🔥 Najnovšie akcie</h2>
              <p className="sec-sub">Aktuálne výpredaje obchodov a zľavnené produkty</p>
            </div>
            <a href="/akcie" className="see-all">Všetky akcie →</a>
          </div>

          {articles.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 20 }}>
              {articles.map((a) => <ArticleCard key={a.slug} article={a} />)}
            </div>
          ) : (
            <div style={{ padding: "48px 24px", textAlign: "center", color: "#9ca3af", background: "#f8f9fa", borderRadius: 16, border: "1px solid #eceff3", fontSize: 14 }}>
              Nové akcie pripravujeme — pozri zatiaľ <a href="/kupony" style={{ color: ORANGE_DARK, fontWeight: 700 }}>kupóny</a> a <a href="/obchody" style={{ color: ORANGE_DARK, fontWeight: 700 }}>obchody</a>.
            </div>
          )}
        </main>

        {/* Sidebar */}
        <aside className="home-sidebar" style={{ position: "sticky", top: 80, display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Top kupóny */}
          {topCoupons.length > 0 && (
            <div style={{ background: "#fff", border: "1.5px solid #eceff3", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
              <div style={{ padding: "14px 16px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 800, fontSize: 15 }}>🏷️ Top kupóny</span>
                <a href="/kupony" className="see-all" style={{ fontSize: 12 }}>Všetky →</a>
              </div>
              {topCoupons.map((c) => (
                <a key={c.shopSlug} href={`/kupony/${c.shopSlug}`} className="side-row"
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", textDecoration: "none", color: "#1d1d1f", borderBottom: "1px solid #f5f5f5", transition: "background .1s" }}>
                  <ShopFavicon domain={c.domain} name={c.shopName} size={30} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.shopName}</div>
                    {c.discount && <div style={{ fontSize: 11, color: GREEN, fontWeight: 700 }}>{c.discount}</div>}
                  </div>
                  <span style={{ fontSize: 12, color: "#ccc" }}>→</span>
                </a>
              ))}
            </div>
          )}

          {/* Populárne obchody */}
          <div style={{ background: "#fff", border: "1.5px solid #eceff3", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 800, fontSize: 15 }}>🏪 Populárne obchody</span>
              <a href="/obchody" className="see-all" style={{ fontSize: 12 }}>Všetky →</a>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", padding: 8, gap: 6 }}>
              {topShops.map((s) => (
                <TrackedLink key={s.slug} href={`/kupony/${s.slug}`} type="shop_outbound" shopSlug={s.slug} destinationDomain={s.domain}
                  className="side-row"
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 6px", borderRadius: 10, textDecoration: "none", color: "#1d1d1f" }}>
                  <ShopFavicon domain={s.domain} name={s.name} size={34} />
                  <span style={{ fontSize: 11, fontWeight: 700, textAlign: "center", lineHeight: 1.25 }}>{s.name}</span>
                </TrackedLink>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* HEUREKA FALLBACK */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "56px 20px 0" }}>
        <div style={{ background: "linear-gradient(135deg, #F0FDF4 0%, #ecfdf5 100%)", border: "1.5px solid #bbf7d0", borderRadius: 20, padding: "40px 28px", textAlign: "center" }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🔍</div>
          <h2 style={{ fontSize: "clamp(20px, 3vw, 26px)", fontWeight: 800, margin: "0 0 8px", letterSpacing: "-0.4px" }}>Hľadáš konkrétny produkt?</h2>
          <p style={{ fontSize: 15, color: "#4b5563", lineHeight: 1.6, margin: "0 auto 22px", maxWidth: 480 }}>
            Na Heureke nájdeš ponuky od stoviek overených predajcov a porovnáš ceny.
          </p>
          <TrackedLink href={heurekaHome} target="_blank" rel="noopener noreferrer" type="heureka_fallback" destinationDomain="heureka.sk"
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "15px 32px", borderRadius: 14, background: GREEN, color: "#fff", fontWeight: 800, fontSize: 16, textDecoration: "none", boxShadow: "0 4px 18px rgba(34,197,94,0.30)" }}>
            Hľadať na Heureke ↗
          </TrackedLink>
        </div>
      </section>

      <div style={{ height: 80 }} />
      <Footer />
    </div>
  );
}
