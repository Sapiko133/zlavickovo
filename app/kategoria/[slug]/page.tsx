import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import CouponCard from "@/components/CouponCard";
import ShopFavicon from "@/components/ShopFavicon";
import { getCouponsByCategory } from "@/lib/category-coupons";
import { TAXONOMY, TAXONOMY_LIST, isCategoryId, type TaxonomyCategory } from "@/lib/taxonomy";
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { cache } from "react";
import Breadcrumbs from "@/components/Breadcrumbs";
import { getAllArticles, type Article } from "@/lib/articles";
import { absoluteUrl, clampDescription, plural } from "@/lib/seo/config";
import { breadcrumbJsonLd, buildJsonLdGraph, itemListJsonLd, type Crumb } from "@/lib/seo/jsonld";
import { getShopRegistry } from "@/lib/seo/shop-registry";
import { articlesByShop, getShopSeoIndex, type ShopSeoStat } from "@/lib/seo/shop-index";
import { categoryIndexDecision } from "@/lib/seo/indexing";
import { buildCategoryShops } from "@/lib/seo/category-shops";
import { categoryTitleVariants, fitTitle, metadataTitle } from "@/lib/seo/title";
import { withTimeout } from "@/lib/with-timeout";

export const revalidate = 3600;

export function generateStaticParams() {
  return TAXONOMY_LIST.map(c => ({ slug: c.id }));
}

/** Viditeľná kategória podľa URL slugu, null pre neznáme/skryté ("ine"). */
function getVisibleCategory(slug: string): TaxonomyCategory | null {
  if (!isCategoryId(slug)) return null;
  const cat = TAXONOMY[slug];
  return cat.hidden ? null : cat;
}

function monthYear() {
  const now = new Date();
  return { month: new Intl.DateTimeFormat("sk-SK", { month: "long" }).format(now), year: now.getFullYear() };
}

/**
 * Dáta kategórie (zdieľané metadata + render cez React cache):
 * obchody = kurátorské featured + Affial + SEO index (obchody kategórie s aktívnou ponukou),
 * každý odkaz overený registrom (žiadne odkazy na 404), zoradené podľa počtu ponúk.
 */
const loadCategory = cache(async (slug: string) => {
  if (slug !== slug.toLowerCase()) permanentRedirect(`/kategoria/${slug.toLowerCase()}`);
  const cat = getVisibleCategory(slug);
  if (!cat) notFound();

  const [reg, index, allArticles, coupons] = await Promise.all([
    getShopRegistry(),
    getShopSeoIndex().catch(() => [] as ShopSeoStat[]),
    withTimeout(getAllArticles(), 3000, [] as Article[]),
    getCouponsByCategory(cat.id, 12).catch(() => []),
  ]);
  const shopList = buildCategoryShops(cat, reg, index);

  const catSlugs = new Set(index.filter(s => s.categoryId === cat.id).map(s => s.slug));
  for (const s of shopList) catSlugs.add(s.slug);
  const byShop = articlesByShop(allArticles, reg);
  const articles = [...byShop.entries()]
    .filter(([shopSlug]) => catSlugs.has(shopSlug))
    .flatMap(([, list]) => list)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);

  const kuponyList = coupons.filter((c: any) => c.code && String(c.code).trim() !== "");
  const akcieList = coupons.filter((c: any) => !c.code || String(c.code).trim() === "");
  const shopsWithOffers = shopList.filter(s => s.offers > 0);
  const totalOffers = shopsWithOffers.reduce((n, s) => n + s.offers, 0);
  // Rovnaké vstupy ako sitemap (lib/seo/sitemap.ts) → meta robots a sitemap sa nerozídu.
  const decision = categoryIndexDecision({ shopCount: shopList.length, activeOffers: totalOffers });

  return { cat, shopList, shopsWithOffers, totalOffers, articles, kuponyList, akcieList, decision };
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const d = await loadCategory(slug);
  const { month, year } = monthYear();
  const label = d.cat.label;
  const lc = label.toLowerCase();
  const top = d.shopsWithOffers.slice(0, 3).map(s => s.name);
  const url = absoluteUrl(`/kategoria/${d.cat.id}`);
  // Search intent "{kategória} akcie / zľavy" — kategória vpredu, bez opakovania slov.
  const fitted = fitTitle(categoryTitleVariants(label, month, year));
  const title = fitted.text;
  const description = clampDescription(
    top.length > 0
      ? `Akcie a zľavové kódy v kategórii ${lc}: ${d.shopsWithOffers.length} ${plural(d.shopsWithOffers.length, "obchod", "obchody", "obchodov")} s aktuálnou ponukou, napr. ${top.join(", ")}. Prehľad na ${month} ${year}.`
      : `Obchody v kategórii ${lc} a ich zľavové kódy a akcie na jednom mieste. ${d.cat.desc}`,
  );
  return {
    title: metadataTitle(fitted),
    description,
    alternates: { canonical: url },
    robots: d.decision.index ? undefined : { index: false, follow: true },
    openGraph: { title, description, url, type: "website", locale: "sk_SK" },
  };
}

function getCategoryFAQ(cat: { label: string; featuredShops: { name: string }[] }) {
  const shopNames = cat.featuredShops.slice(0, 3).map(s => s.name).join(", ");
  return [
    {
      q: `Kde nájdem zľavy na ${cat.label.toLowerCase()}?`,
      a: shopNames
        ? `Aktuálne akcie a zľavové kódy pre ${cat.label.toLowerCase()} nájdeš v obchodoch ako ${shopNames} — všetky na jednom mieste na Zlavickovo.sk. Pred nákupom skontroluj aktuálne kupóny obchodu.`
        : `Aktuálne akcie a zľavové kódy pre ${cat.label.toLowerCase()} nájdeš na Zlavickovo.sk. Pred nákupom skontroluj aktuálne kupóny obchodu.`,
    },
    {
      q: `Ako ušetriť na ${cat.label.toLowerCase()}?`,
      a: `Použi zľavový kód pri objednávke a sleduj sezónne výpredaje a akcie obchodov. Kupóny a akcie pre kategóriu ${cat.label.toLowerCase()} pravidelne aktualizujeme z affiliate sietí obchodov.`,
    },
    {
      q: `Má ${cat.featuredShops[0]?.name ?? "váš obchod"} aktuálny kupón?`,
      a: `Aktuálne kupóny a akcie pre obchody v kategórii ${cat.label} nájdeš priamo na tejto stránke. Ponuky pravidelne aktualizujeme; platnosť kódu si over v pokladni obchodu.`,
    },
  ];
}

export default async function KategoriaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = await loadCategory(slug);
  const { cat, shopList, shopsWithOffers, totalOffers, articles, kuponyList, akcieList } = d;
  const { month, year } = monthYear();
  const faq = getCategoryFAQ(cat);
  const lc = cat.label.toLowerCase();

  // Dátový úvod (nie AI text): reálne počty a obchody s ponukou tejto kategórie.
  const top = shopsWithOffers.slice(0, 3).map(s => s.name);
  const intro = shopsWithOffers.length > 0
    ? `V kategórii ${lc} sledujeme ${shopList.length} ${plural(shopList.length, "obchod", "obchody", "obchodov")}. ` +
      `Aktuálne má ${shopsWithOffers.length} z nich spolu ${totalOffers} ${plural(totalOffers, "aktívnu ponuku", "aktívne ponuky", "aktívnych ponúk")} ` +
      `(zľavové kódy a akcie)${top.length ? ` – najviac ${top.join(", ")}` : ""}. Prehľad aktualizujeme priebežne podľa affiliate sietí, stav k ${month} ${year}.`
    : `V kategórii ${lc} sledujeme ${shopList.length} ${plural(shopList.length, "obchod", "obchody", "obchodov")}. Momentálne tu nemáme aktívnu akciu ani kód – pozri stránky jednotlivých obchodov alebo iné kategórie.`;

  const crumbs: Crumb[] = [
    { name: "Domov", path: "/" },
    { name: "Kategórie", path: "/kategoria" },
    { name: cat.label, path: `/kategoria/${cat.id}` },
  ];
  // ItemList = viditeľné karty obchodov (každá odkazuje na /kupony/[slug]).
  const jsonLd = buildJsonLdGraph([
    breadcrumbJsonLd(crumbs),
    itemListJsonLd(`Obchody v kategórii ${cat.label}`, shopList.map(s => ({ name: s.name, path: `/kupony/${s.slug}` }))),
  ]);

  return (
    <div data-active-offers={totalOffers} style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "'Inter', system-ui, sans-serif", color: "#1d1d1f" }}>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />}
      <style>{`
        .shop-card-k { transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s; }
        .shop-card-k:hover { border-color: ${cat.color} !important; box-shadow: 0 6px 20px ${cat.color}22 !important; transform: translateY(-2px); }
        .cat-chip { transition: background 0.15s, color 0.15s; }
        .cat-chip:hover { opacity: 0.8; }
      `}</style>
      <Nav />

      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${cat.bg} 0%, #fff 100%)`, borderBottom: `1px solid ${cat.color}30`, padding: "48px 24px 36px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ marginBottom: 10 }}>
            <Breadcrumbs items={crumbs} color="#6b7280" activeColor={cat.color} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <span style={{ fontSize: 52, lineHeight: 1 }}>{cat.emoji}</span>
            <div>
              <h1 style={{ fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 800, margin: "0 0 6px", letterSpacing: "-0.5px" }}>
                {cat.label}: akcie a zľavové kódy
              </h1>
              <p style={{ fontSize: 15, color: "#555", margin: "0 0 6px" }}>{cat.desc}</p>
              <p style={{ fontSize: 14, color: "#555", margin: 0, maxWidth: 760, lineHeight: 1.6 }}>{intro}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Other categories quick nav */}
      <div style={{ background: "#fff", borderBottom: "1px solid #f0f0f0", overflowX: "auto" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "10px 24px", display: "flex", gap: 6 }}>
          {TAXONOMY_LIST.map(c => (
            <a
              key={c.id}
              href={`/kategoria/${c.id}`}
              className="cat-chip"
              style={{
                padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                textDecoration: "none", whiteSpace: "nowrap",
                background: c.id === slug ? cat.color : "#f5f5f5",
                color: c.id === slug ? "#fff" : "#666",
              }}
            >
              {c.emoji} {c.label}
            </a>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px 64px" }}>

        {/* Shops grid — overené odkazy, obchody s aktívnou ponukou prvé */}
        {shopList.length > 0 && (
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 18px", color: "#1d1d1f" }}>
            Obchody v kategórii {cat.label}
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
            {shopList.map(shop => (
              <a
                key={shop.slug}
                href={`/kupony/${shop.slug}`}
                className="shop-card-k"
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center",
                  gap: 10, padding: "20px 14px 16px", borderRadius: 14,
                  background: "#fff", border: "1.5px solid #e8e8e8",
                  textDecoration: "none", color: "#1d1d1f",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                }}
              >
                <ShopFavicon domain={shop.domain} name={shop.name} size={52} />
                <span style={{ fontSize: 13, fontWeight: 600, textAlign: "center", lineHeight: 1.3 }}>
                  {shop.name}
                </span>
                <span style={{ fontSize: 11, color: cat.color, fontWeight: 600, background: cat.bg, padding: "2px 8px", borderRadius: 100 }}>
                  {shop.offers > 0 ? `${shop.offers} ${plural(shop.offers, "ponuka", "ponuky", "ponúk")} →` : "kupóny →"}
                </span>
              </a>
            ))}
          </div>
        </section>
        )}

        {/* Kupóny (s kódom) — sekcia sa zobrazí len ak má obsah */}
        {kuponyList.length > 0 && (
          <section>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 18px", color: "#1d1d1f" }}>
              🎟️ Kupóny pre {cat.label.toLowerCase()}
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
              {kuponyList.map((coupon: any) => {
                const token = Buffer.from(`cat:${coupon.code}`).toString("base64");
                const { code: _c, ...couponData } = coupon;
                return <CouponCard key={coupon.id} coupon={couponData} token={token} />;
              })}
            </div>
          </section>
        )}

        {/* Akcie (bez kódu) — sekcia sa zobrazí len ak má obsah */}
        {akcieList.length > 0 && (
          <section style={{ marginTop: kuponyList.length > 0 ? 48 : 0 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 18px", color: "#1d1d1f" }}>
              🔥 Akcie pre {cat.label.toLowerCase()}
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
              {akcieList.map((coupon: any) => (
                <CouponCard key={coupon.id} coupon={coupon} token={null} />
              ))}
            </div>
          </section>
        )}

        {/* Akcie obchodov kategórie s vlastnou stránkou (kategória → ponuky) */}
        {articles.length > 0 && (
          <section style={{ marginTop: 48 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 18px", color: "#1d1d1f" }}>
              📰 Aktuálne akcie – {lc}
            </h2>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
              {articles.map(a => (
                <li key={a.slug} style={{ background: "#fff", borderRadius: 12, border: "1px solid #eaecf0", padding: "14px 16px" }}>
                  <a href={`/akcie/${a.slug}`} style={{ color: "#1d1d1f", fontWeight: 600, fontSize: 14, textDecoration: "none", lineHeight: 1.45 }}>{a.title}</a>
                  {a.shopName && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{a.shopName}{a.validTo ? ` · do ${new Date(a.validTo).toLocaleDateString("sk-SK")}` : ""}</div>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Link to all coupons */}
        <div style={{ marginTop: 32, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <a href="/kategoria" style={{ padding: "11px 22px", borderRadius: 10, background: cat.color, color: "#fff", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
            ← Všetky kategórie
          </a>
          <a href="/obchody" style={{ padding: "11px 22px", borderRadius: 10, background: "#f5f5f5", color: "#555", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
            Všetky obchody
          </a>
        </div>

        {/* FAQ */}
        <div style={{ marginTop: 48, background: "#fff", borderRadius: 14, border: "1px solid #eaecf0", padding: "32px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 24px", letterSpacing: "-0.3px", color: "#1d1d1f" }}>
            Časté otázky – {cat.label} kupóny
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {faq.map((item, i) => (
              <div key={i} style={{ padding: "18px 0", borderBottom: i < faq.length - 1 ? "1px solid #f0f0f0" : "none" }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: "#1d1d1f", marginBottom: 6 }}>{item.q}</div>
                <div style={{ fontSize: 13, color: "#666", lineHeight: 1.6 }}>{item.a}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
