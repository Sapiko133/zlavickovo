import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import CouponCard from "@/components/CouponCard";
import ShopFavicon from "@/components/ShopFavicon";
import { getShopDomain } from "@/lib/shop-domains";
import { compareShopsByPriority } from "@/lib/shop-priority";
import { normalizeShopName, normalizeShopSlug } from "@/lib/slug";
import { getCouponsByCategory } from "@/lib/category-coupons";
import { TAXONOMY, TAXONOMY_LIST, isCategoryId, type TaxonomyCategory } from "@/lib/taxonomy";
import { AFFIAL_SHOPS } from "@/lib/affial-shops";
import { notFound } from "next/navigation";
import { getProductsByHkCategory, toProductSlug, formatPrice } from "@/lib/heureka/query";
import type { HkProduct } from "@/lib/heureka/types";

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

function getYear() { return new Date().getFullYear(); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cat = getVisibleCategory(slug);
  if (!cat) return {};
  return {
    title: `${cat.label} kupóny a zľavy | Zlavickovo.sk`,
    description: `Aktuálne overené kupóny pre ${cat.label.toLowerCase()}. Ušetri na nákupe.`,
    alternates: { canonical: `https://www.zlavickovo.sk/kategoria/${slug}` },
    openGraph: {
      title: `${cat.label} kupóny a zľavy | Zlavickovo.sk`,
      description: `Aktuálne overené kupóny pre ${cat.label.toLowerCase()}. Ušetri na nákupe.`,
      url: `https://www.zlavickovo.sk/kategoria/${slug}`, type: "website",
    },
  };
}

function getCategoryFAQ(cat: { label: string; featuredShops: { name: string }[] }) {
  const shopNames = cat.featuredShops.slice(0, 3).map(s => s.name).join(", ");
  return [
    {
      q: `Kde kúpiť ${cat.label.toLowerCase()} najlacnejšie?`,
      a: `Najlepšie ceny ${cat.label.toLowerCase()} nájdete v obchodoch ako ${shopNames}. Pred nákupom vždy skontrolujte aktuálne kupóny a zľavové kódy na Zlavickovo.sk — môžete ušetriť až 20%.`,
    },
    {
      q: `Ako ušetriť na ${cat.label.toLowerCase()}?`,
      a: `Použite zľavový kód pri objednávke, sledujte sezónne výpredaje a akcie obchodov. Na Zlavickovo.sk pravidelne aktualizujeme overené kupóny pre všetky kategórie vrátane ${cat.label.toLowerCase()}.`,
    },
    {
      q: `Má ${cat.featuredShops[0]?.name ?? "váš obchod"} aktuálny kupón?`,
      a: `Aktuálne kupóny pre všetky obchody v kategórii ${cat.label} nájdete priamo na tejto stránke. Kódy sú overené a pravidelne aktualizované.`,
    },
  ];
}

export default async function KategoriaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cat = getVisibleCategory(slug);
  if (!cat) notFound();
  const year = getYear();
  const faq = getCategoryFAQ(cat);

  // Obchody kategórie — .sk → .cz → ostatné, abecedne. Deduplikované podľa
  // kanonického mena (normalizeShopName zahodí TLD aj interpunkciu), takže
  // kurátorský featured obchod, jeho Affial záznam a .sk/.cz mutácie sa
  // zobrazia len raz — featured má prednosť, potom .sk pred .cz.
  const seenShopKeys = new Set<string>();
  const catShops = [...cat.featuredShops].sort(compareShopsByPriority).filter(shop => {
    const key = normalizeShopName(shop.name) || shop.slug;
    if (seenShopKeys.has(key)) return false;
    seenShopKeys.add(key);
    return true;
  });
  const affialForCat = AFFIAL_SHOPS
    .filter(s => s.category === cat.id)
    .sort(compareShopsByPriority)
    .filter(shop => {
      const key = normalizeShopName(shop.domain || shop.name);
      if (seenShopKeys.has(key)) return false;
      seenShopKeys.add(key);
      return true;
    });

  // Produkty z Heureka DB — iba pre pilotné kategórie (krasa, sport, byvanie)
  const PILOT_CATS = new Set(["krasa", "sport", "byvanie"]);

  // Parallelizovane: kupony (podla kategorie obchodu, nie keywords) + produkty (DB)
  const [coupons, hkProducts] = await Promise.all([
    getCouponsByCategory(cat.id, 12).catch(() => []),
    PILOT_CATS.has(slug) ? getProductsByHkCategory(slug, 8).catch(() => []) : Promise.resolve<HkProduct[]>([]),
  ]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Domov", "item": "https://www.zlavickovo.sk" },
          { "@type": "ListItem", "position": 2, "name": "Kategórie", "item": "https://www.zlavickovo.sk/kategoria" },
          { "@type": "ListItem", "position": 3, "name": cat.label, "item": `https://www.zlavickovo.sk/kategoria/${slug}` },
        ],
      },
      {
        "@type": "FAQPage",
        "mainEntity": faq.map(f => ({
          "@type": "Question", "name": f.q,
          "acceptedAnswer": { "@type": "Answer", "text": f.a },
        })),
      },
    ],
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "'Inter', system-ui, sans-serif", color: "#1d1d1f" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
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
          <div style={{ fontSize: 12, color: "#999", marginBottom: 10 }}>
            <a href="/" style={{ color: "#999", textDecoration: "none" }}>Zlavickovo</a>
            {" › "}
            <a href="/kategoria" style={{ color: "#999", textDecoration: "none" }}>Kategórie</a>
            {" › "}
            <span style={{ color: cat.color, fontWeight: 600 }}>{cat.label}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <span style={{ fontSize: 52, lineHeight: 1 }}>{cat.emoji}</span>
            <div>
              <h1 style={{ fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 800, margin: "0 0 6px", letterSpacing: "-0.5px" }}>
                Najlepšie {cat.label.toLowerCase()} zľavy a kupóny {year}
              </h1>
              <p style={{ fontSize: 15, color: "#666", margin: 0 }}>{cat.desc}</p>
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

        {/* Shops grid */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 18px", color: "#1d1d1f" }}>
            Obchody v kategórii {cat.label}
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
            {catShops.map(shop => {
              const href = shop.href ?? `/kupony/${shop.slug}`;
              return (
                <a
                  key={shop.slug}
                  href={href}
                  className="shop-card-k"
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center",
                    gap: 10, padding: "20px 14px 16px", borderRadius: 14,
                    background: "#fff", border: "1.5px solid #e8e8e8",
                    textDecoration: "none", color: "#1d1d1f",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  }}
                >
                  <ShopFavicon domain={getShopDomain(shop.name) || `${shop.slug}.sk`} name={shop.name} size={52} />
                  <span style={{ fontSize: 13, fontWeight: 600, textAlign: "center", lineHeight: 1.3 }}>
                    {shop.name}
                  </span>
                  <span style={{ fontSize: 11, color: cat.color, fontWeight: 600, background: cat.bg, padding: "2px 8px", borderRadius: 100 }}>
                    kupóny →
                  </span>
                </a>
              );
            })}

            {/* Affial shops for this category */}
            {affialForCat.map(shop => {
              const href = `/kupony/${normalizeShopSlug(shop.domain)}`;
              return (
                <a
                  key={shop.domain}
                  href={href}
                  className="shop-card-k"
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center",
                    gap: 10, padding: "20px 14px 16px", borderRadius: 14,
                    background: "#fff", border: "1.5px solid #e8e8e8",
                    textDecoration: "none", color: "#1d1d1f",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  }}
                >
                  <ShopFavicon domain={shop.domain || ""} name={shop.name} size={52} />
                  <span style={{ fontSize: 13, fontWeight: 600, textAlign: "center", lineHeight: 1.3 }}>
                    {shop.name}
                  </span>
                  <span style={{ fontSize: 11, color: "#16A34A", fontWeight: 700, background: "#F0FDF4", padding: "2px 8px", borderRadius: 100 }}>
                    kupóny →
                  </span>
                </a>
              );
            })}
          </div>
        </section>

        {/* Coupons */}
        <section>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 18px", color: "#1d1d1f" }}>
            🎟️ Kupóny pre {cat.label.toLowerCase()}
          </h2>
          {coupons.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
              {coupons.map((coupon: any) => {
                const token = coupon.code ? Buffer.from(`cat:${coupon.code}`).toString("base64") : null;
                const { code: _c, ...couponData } = coupon;
                return <CouponCard key={coupon.id} coupon={couponData} token={token} />;
              })}
            </div>
          ) : (
            <div style={{ padding: "40px", textAlign: "center", color: "#aaa", background: "#fff", borderRadius: 14, border: "1px solid #e8e8e8" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
              <p style={{ margin: 0 }}>Momentálne žiadne kupóny. Skontroluj neskôr.</p>
            </div>
          )}
        </section>

        {/* Produkty z Heureka DB */}
        {hkProducts.length > 0 && (
          <section style={{ marginTop: 48 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "#1d1d1f" }}>
                🛍️ Produkty v kategórii {cat.label}
              </h2>
              <a
                href={`/produkty?kategoria=${slug}`}
                style={{ fontSize: 13, color: cat.color, fontWeight: 600, textDecoration: "none" }}
              >
                Všetky produkty →
              </a>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
              {hkProducts.map((p: HkProduct) => {
                const pSlug = toProductSlug(p.name, p.id);
                const pPrice = formatPrice(p.price, p.domain);
                return (
                  <a
                    key={p.id}
                    href={`/produkt/${pSlug}`}
                    style={{
                      display: "flex", flexDirection: "column",
                      background: "#fff", borderRadius: 12, border: "1.5px solid #e8e8e8",
                      textDecoration: "none", color: "#1d1d1f", overflow: "hidden",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                    }}
                  >
                    <div style={{ aspectRatio: "1", background: "#f8f9fa", display: "flex", alignItems: "center", justifyContent: "center", padding: 8 }}>
                      {p.img_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.img_url} alt={p.name} loading="lazy" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                      ) : (
                        <ShopFavicon domain={p.domain} name={p.domain} size={36} />
                      )}
                    </div>
                    <div style={{ padding: "10px 12px 12px" }}>
                      <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.4, color: "#1d1d1f", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden", marginBottom: 6 }}>
                        {p.name}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        {pPrice ? (
                          <span style={{ fontSize: 13, fontWeight: 800, color: "#22C55E" }}>{pPrice}</span>
                        ) : (
                          <span style={{ fontSize: 11, color: "#aaa" }}>Cena na webe</span>
                        )}
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
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
