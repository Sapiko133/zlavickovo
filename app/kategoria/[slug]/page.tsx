import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import CouponCard from "@/components/CouponCard";
import ShopFavicon from "@/components/ShopFavicon";
import { getShopDomain } from "@/lib/shop-domains";
import { getCoupons } from "@/lib/dognet";
import { getEhubCoupons } from "@/lib/ehub";
import { CATEGORIES, CATEGORIES_LIST } from "@/lib/categories";
import { AFFIAL_SHOPS } from "@/lib/affial-shops";
import { notFound } from "next/navigation";

export const revalidate = 3600;

export function generateStaticParams() {
  return Object.keys(CATEGORIES).map(slug => ({ slug }));
}

function getYear() { return new Date().getFullYear(); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cat = CATEGORIES[slug];
  if (!cat) return {};
  return {
    title: `${cat.label} - kupóny, akcie a cashback | Zlavickovo.sk`,
    description: `Nájdi najlepšie ${cat.label.toLowerCase()} kupóny a zľavy. Porovnaj ceny v ${cat.shops.length} obchodoch. Overené kódy ${getYear()}.`,
    alternates: { canonical: `https://zlavickovo.sk/kategoria/${slug}` },
    openGraph: {
      title: `${cat.label} kupóny a zľavy ${getYear()} | Zlavickovo.sk`,
      description: `Aktuálne ${cat.label.toLowerCase()} kupóny. Ušetri v ${cat.shops.length} partnerských obchodoch.`,
      url: `https://zlavickovo.sk/kategoria/${slug}`, type: "website",
    },
  };
}

function getCategoryFAQ(cat: { label: string; shops: { name: string }[] }) {
  const shopNames = cat.shops.slice(0, 3).map(s => s.name).join(", ");
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
      q: `Má ${cat.shops[0]?.name ?? "váš obchod"} aktuálny kupón?`,
      a: `Aktuálne kupóny pre všetky obchody v kategórii ${cat.label} nájdete priamo na tejto stránke. Kódy sú overené a pravidelne aktualizované.`,
    },
  ];
}

export default async function KategoriaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cat = CATEGORIES[slug];
  if (!cat) notFound();
  const year = getYear();
  const faq = getCategoryFAQ(cat);

  // Fetch coupons
  let coupons: any[] = [];
  try {
    const [dognet, ehub] = await Promise.allSettled([getCoupons(), getEhubCoupons()]);
    const all = [
      ...(dognet.status === "fulfilled" ? dognet.value : []),
      ...(ehub.status === "fulfilled" ? ehub.value : []),
    ];
    coupons = all.filter((c: any) => {
      const name = (c.campaign?.name || c.campaign_name || "").toLowerCase();
      const title = (c.title || c.name || "").toLowerCase();
      return (
        cat.shops.some(s => name.includes(s.name.toLowerCase()) || name.includes(s.slug)) ||
        cat.keywords.some(k => name.includes(k) || title.includes(k))
      );
    }).slice(0, 12);
  } catch {}

  // Get Affial shops for this category
  const affialForCat = AFFIAL_SHOPS.filter(s => s.category === slug || s.category === cat.slug);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Zlavickovo", "item": "https://zlavickovo.sk" },
          { "@type": "ListItem", "position": 2, "name": "Kategórie", "item": "https://zlavickovo.sk/kategoria" },
          { "@type": "ListItem", "position": 3, "name": cat.label, "item": `https://zlavickovo.sk/kategoria/${slug}` },
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
          {CATEGORIES_LIST.map(c => (
            <a
              key={c.slug}
              href={`/kategoria/${c.slug}`}
              className="cat-chip"
              style={{
                padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                textDecoration: "none", whiteSpace: "nowrap",
                background: c.slug === slug ? cat.color : "#f5f5f5",
                color: c.slug === slug ? "#fff" : "#666",
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
            {cat.shops.map(shop => {
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
              const href = `/kupony/${shop.domain.replace(".", "-")}`;
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
                    💰 {shop.commission}
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
