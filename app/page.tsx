import ShopFavicon from "@/components/ShopFavicon";
import Image from "next/image";
import Link from "next/link";
import { compareShopsByPriority } from "@/lib/shop-priority";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import HeroSearch from "@/components/HeroSearch";
import TrackedLink from "@/components/TrackedLink";
import { getVypredaje, type VypredajItem } from "@/lib/vypredaje";
import { getStaticSales } from "@/lib/static-data";
import { AFFIAL_COUPONS } from "@/lib/affial-coupons";
import { getClickStats } from "@/lib/click-log";
import { getShopDomain } from "@/lib/shop-domains";
import { normalizeShopSlug } from "@/lib/slug";
import { isOfferActive } from "@/lib/offers/freshness";
import { TAXONOMY_LIST } from "@/lib/taxonomy";
import { isAdultShop } from "@/lib/shop-categories";

export const revalidate = 3600;

export const metadata = {
  title: "Zlavickovo ✂️ Akcie, výpredaje a kupóny slovenských obchodov",
  description: "Aktuálne akcie, výpredaje a zľavové kupóny slovenských obchodov. Nové ponuky z affiliate sietí pravidelne na jednom mieste.",
  alternates: { canonical: "https://www.zlavickovo.sk" },
  openGraph: {
    title: "Zlavickovo – Akcie, výpredaje a kupóny",
    description: "Aktuálne akcie obchodov a zľavové kupóny na jednom mieste.",
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

// Obchody, ktoré nechceme propagovať na homepage (18+ + alkohol/tabak/vape).
// Shop stránky a sitemap zostávajú dostupné — filtrujeme len odporúčania na úvode.
const HOME_RESTRICTED_RX = /alkohol|alkoshop|whisky|whiskey|\bvino\b|tabak|tabac|cigaret|\bvape\b|e-?cigaret/i;
function isRestrictedForHome(x: { slug?: string | null; name?: string | null; domain?: string | null }): boolean {
  return isAdultShop(x) || HOME_RESTRICTED_RX.test(`${x.slug ?? ""} ${x.name ?? ""} ${x.domain ?? ""}`);
}

interface CouponRow {
  shopName: string;
  domain: string;
  shopSlug: string;
  discount: string | null;
}

interface StaticSale {
  code?: string | null;
  affiliate_link?: string | null;
  url?: string | null;
  valid_to?: string | null;
  title?: string | null;
  description?: string | null;
  campaign?: { name?: string | null; url?: string | null; website_url?: string | null } | null;
}

function domainOf(c: StaticSale): string {
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

function HomeDealCard({ item, featured = false }: { item: VypredajItem; featured?: boolean }) {
  const card = (
    <article className={featured ? "home-deal-card home-deal-card-featured" : "home-deal-card"}>
      {item.imageUrl ? (
        <div className="home-deal-image">
          <Image
            src={item.imageUrl}
            alt={`Aktuálna akcia ${item.shopName}: ${item.title}`}
            width={1200}
            height={630}
            sizes={featured ? "(max-width: 900px) 100vw, 520px" : "(max-width: 620px) 100vw, 320px"}
            priority={featured}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        </div>
      ) : (
        <div className="home-deal-fallback">
          <ShopFavicon domain={item.domain} name={item.shopName} size={featured ? 64 : 50} />
        </div>
      )}
      <div className="home-deal-content">
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 7 }}>
          <span style={{ color: item.hasPct ? "#16A34A" : "#475569", background: item.hasPct ? "#DCFCE7" : "#F1F5F9", padding: "4px 9px", borderRadius: 999, fontSize: 11, fontWeight: 900 }}>{item.badge}</span>
          <span style={{ color: "#64748B", fontSize: 11 }}>{item.meta}</span>
        </div>
        <h3 style={{ margin: 0, color: "#0F172A", fontSize: featured ? 20 : 15, lineHeight: 1.4 }}>{item.title}</h3>
        <div style={{ marginTop: 8, color: "#16A34A", fontSize: 12, fontWeight: 800 }}>{item.shopName} · Pozrieť akciu →</div>
      </div>
    </article>
  );
  if (item.detailUrl) return <a href={item.detailUrl} style={{ textDecoration: "none" }}>{card}</a>;
  if (!item.external) return <a href={item.ctaUrl} style={{ textDecoration: "none" }}>{card}</a>;
  return (
    <TrackedLink href={item.ctaUrl} target="_blank" rel="nofollow noopener noreferrer" type={item.clickType} shopSlug={item.shopSlug} destinationDomain={item.domain} style={{ textDecoration: "none" }}>
      {card}
    </TrackedLink>
  );
}

export default async function Home() {
  const { items: currentDeals } = await getVypredaje();

  // Kanonický freshness model (neparsovateľný dátum NIE je aktívny, SK formát OK).
  const notExpired = (v?: string | null) => isOfferActive(v ?? null);

  // ── TOP KUPÓNY (5) — Dognet + Affial kupóny s kódom, jeden obchod raz ──
  const sales = getStaticSales() as StaticSale[];
  const dognetKupony: CouponRow[] = sales
    .filter((c) => c.code?.trim() && (c.affiliate_link || c.url) && notExpired(c.valid_to))
    .map((c) => {
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
    // 18+ / alkohol / tabak nepropagujeme na homepage.
    if (isRestrictedForHome({ slug: c.shopSlug, name: c.shopName, domain: c.domain })) continue;
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
    topShops = c.windows.last30d.topShops
      .map((r) => shopFromSlug(r.key))
      .filter((s) => !isRestrictedForHome({ slug: s.slug, name: s.name, domain: s.domain }))
      .slice(0, 8);
  } catch {}
  if (topShops.length === 0) topShops = FAVOURITE_SHOPS;

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff", fontFamily: "system-ui,-apple-system,sans-serif", color: "#1d1d1f" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [
          { "@type": "Organization", "@id": "https://www.zlavickovo.sk/#organization", name: "Zlavickovo", url: "https://www.zlavickovo.sk" },
          {
            "@type": "WebSite", "@id": "https://www.zlavickovo.sk/#website", name: "Zlavickovo", alternateName: "Zlavickovo.sk", url: "https://www.zlavickovo.sk", inLanguage: "sk-SK",
            publisher: { "@id": "https://www.zlavickovo.sk/#organization" },
            potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: "https://www.zlavickovo.sk/hladat?q={search_term_string}" }, "query-input": "required name=search_term_string" },
          },
        ],
      }).replace(/</g, "\\u003c") }} />

      <style>{`
        .sec-title { font-size: clamp(20px, 2.6vw, 26px); font-weight: 800; color: #1d1d1f; margin: 0; letter-spacing: -0.4px; }
        .sec-sub { font-size: 14px; color: #6b7280; margin: 6px 0 0; }
        .see-all { font-size: 14px; color: ${ORANGE_DARK}; text-decoration: none; font-weight: 700; }
        .see-all:hover { text-decoration: underline; }
        .article-card:hover { transform: translateY(-3px); box-shadow: 0 10px 28px rgba(0,0,0,0.10) !important; border-color: ${GREEN} !important; }
        .home-deal-card { height: 100%; display: flex; flex-direction: column; overflow: hidden; background: #fff; border: 1.5px solid #e5e7eb; border-radius: 18px; box-sizing: border-box; transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease; }
        .home-deal-card:hover { transform: translateY(-3px); box-shadow: 0 14px 34px rgba(15,23,42,.12); border-color: ${GREEN}; }
        .home-deal-card-featured { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(240px, .65fr); align-items: stretch; }
        .home-deal-image { position: relative; aspect-ratio: 1200 / 630; overflow: hidden; background: #0f172a; }
        .home-deal-card-featured .home-deal-image { aspect-ratio: auto; min-height: 300px; }
        .home-deal-fallback { min-height: 170px; display: grid; place-items: center; background: linear-gradient(135deg,#0f172a,#14532d); }
        .home-deal-content { min-width: 0; padding: 18px; display: flex; flex-direction: column; justify-content: center; }
        .home-deal-card-featured .home-deal-content { padding: 26px; }
        .side-row:hover { background: #F0FDF4 !important; }
        @media(max-width: 900px) {
          .home-layout { grid-template-columns: 1fr !important; }
          .home-sidebar { position: static !important; }
        }
        @media(max-width: 620px) {
          .article-card-featured { grid-template-columns: 1fr !important; }
          .home-deal-card-featured { grid-template-columns: 1fr; }
          .home-deal-card-featured .home-deal-image { aspect-ratio: 1200 / 630; min-height: 0; }
          .home-deal-card-featured .home-deal-content { padding: 18px; }
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
            Nájdi obchod a pozri jeho aktuálne akcie, výpredaje a kupóny pred nákupom.
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
              <h2 className="sec-title">🔥 Najnovšie akcie a výpredaje</h2>
              <p className="sec-sub">Aktuálne akcie slovenských obchodov — over si zľavu pred nákupom</p>
            </div>
            <Link href="/akcie" className="see-all">Všetky akcie →</Link>
          </div>

          {currentDeals.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              <HomeDealCard item={currentDeals[0]} featured />
              {currentDeals.length > 1 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 22 }}>
                  {currentDeals.slice(1, 12).map((item) => <HomeDealCard key={item.id} item={item} />)}
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: "48px 24px", textAlign: "center", color: "#9ca3af", background: "#f8f9fa", borderRadius: 16, border: "1px solid #eceff3", fontSize: 14 }}>
              Nové akcie pripravujeme — pozri zatiaľ <Link href="/kupony" style={{ color: ORANGE_DARK, fontWeight: 700 }}>kupóny</Link> a <Link href="/obchody" style={{ color: ORANGE_DARK, fontWeight: 700 }}>obchody</Link>.
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
                <Link href="/kupony" className="see-all" style={{ fontSize: 12 }}>Všetky →</Link>
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
              <Link href="/obchody" className="see-all" style={{ fontSize: 12 }}>Všetky →</Link>
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

          {/* Kategórie */}
          <div style={{ background: "#fff", border: "1.5px solid #eceff3", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 800, fontSize: 15 }}>📂 Kategórie</span>
              <Link href="/kategoria" className="see-all" style={{ fontSize: 12 }}>Všetky →</Link>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: 12 }}>
              {TAXONOMY_LIST.map((c) => (
                <Link key={c.id} href={`/kategoria/${c.id}`} className="side-row"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 11px", borderRadius: 999, background: "#F0FDF4", color: "#166534", fontSize: 12, fontWeight: 700, textDecoration: "none", border: "1px solid #DCFCE7" }}>
                  <span>{c.emoji}</span>{c.label}
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <div style={{ height: 80 }} />
      <Footer />
    </div>
  );
}
