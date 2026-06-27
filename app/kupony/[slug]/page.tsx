import { Suspense } from "react";
import { getCouponsByShop } from "@/lib/dognet";
import { getShopDescription } from "@/lib/shop-desc";
import CouponCard from "@/components/CouponCard";
import AiCoupons from "@/components/AiCoupons";
import AdBanner from "@/components/AdBanner";
import TopCodes from "@/components/TopCodes";
import HeurekaSearch from "@/components/HeurekaSearch";
import HeurekaWidget from "@/components/HeurekaWidget";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";

type Props = { params: Promise<{ slug: string }> };

const BASE = "https://zlavickovo.sk";

const TOP_SLUGS = [
  "alza","shein","zalando","mall","notino","sportisimo",
  "ikea","dedoles","martinus","about-you","answear","dr-max",
  "zara","h-m","asos","lidl","kaufland","decathlon","nike","adidas",
];

export function generateStaticParams() {
  return TOP_SLUGS.map(slug => ({ slug }));
}

function currentMonthYear() {
  const now = new Date();
  const month = new Intl.DateTimeFormat("sk-SK", { month: "long" }).format(now);
  return { month, year: now.getFullYear() };
}

function getFAQ(shopName: string) {
  return [
    {
      q: `Ako použiť ${shopName} zľavový kód?`,
      a: `Pridajte produkty do košíka na webe ${shopName}. V pokladni nájdite pole "Zľavový kód" alebo "Promo kód", zadajte kód a kliknite na použiť. Zľava sa automaticky odpočíta z celkovej sumy.`,
    },
    {
      q: `Má ${shopName} dopravu zadarmo?`,
      a: `${shopName} ponúka dopravu zadarmo pri nákupe nad určitú minimálnu sumu alebo pri použití špeciálneho kupónu na dopravu. Skontrolujte aktuálne podmienky priamo na webe obchodu.`,
    },
    {
      q: `Kde nájdem aktuálne ${shopName} kupóny?`,
      a: `Aktuálne overené kupóny pre ${shopName} nájdete práve tu na Zlavickovo.sk. Naše AI automaticky vyhľadáva a overuje kódy z viacerých zdrojov a pravidelne ich aktualizuje.`,
    },
  ];
}

function getRelatedShops(currentSlug: string, count = 4) {
  const others = TOP_SLUGS.filter(s => s !== currentSlug);
  // deterministic "random" based on slug char code
  const seed = currentSlug.charCodeAt(0) + currentSlug.length;
  const start = seed % (others.length - count);
  return others.slice(start, start + count);
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const isCz = slug.endsWith("-cz");
  const baseSlug = isCz ? slug.slice(0, -3) : slug;
  const name = baseSlug.replace(/-/g, " ");
  const shopName = name.charAt(0).toUpperCase() + name.slice(1);
  const { month, year } = currentMonthYear();
  const countryLabel = isCz ? "CZ" : "SK";
  const pageUrl = `${BASE}/kupony/${slug}`;

  return {
    title: `${shopName} zľavový kód ${month} ${year} ✂️ Overené kupóny`,
    description: `✅ Aktuálne overené zľavové kódy pre ${shopName} ${countryLabel}. Ušetri na nákupe. Overené ${month} ${year}. Bez registrácie.`,
    alternates: {
      canonical: pageUrl,
      languages: isCz ? undefined : {
        sk: pageUrl,
        cs: `${BASE}/kupony/${slug}-cz`,
      },
    },
    openGraph: {
      title: `${shopName} zľavové kódy ${month} ${year}`,
      description: `Nájdi najlepšie kupóny pre ${shopName}. Overené kódy aktualizované denne.`,
      url: pageUrl,
      type: "website",
      locale: "sk_SK",
      alternateLocale: ["cs_CZ"],
    },
    twitter: {
      card: "summary_large_image",
      title: `${shopName} zľavový kód ${month} ${year}`,
      description: `✅ Aktuálne overené zľavové kódy pre ${shopName}. Bez registrácie.`,
    },
  };
}

const COLORS = ["#E8001D","#0065BD","#00A551","#FF6900","#7B2FBE","#003580","#D32F2F","#FF4081","#006A35","#8B1A1A"];

export default async function ShopPage({ params }: Props) {
  const { slug } = await params;
  const isCz = slug.endsWith("-cz");
  const baseSlug = isCz ? slug.slice(0, -3) : slug;
  const shopName = baseSlug.replace(/-/g, " ");
  const capitalized = shopName.charAt(0).toUpperCase() + shopName.slice(1);
  const { month, year } = currentMonthYear();
  const pageUrl = `${BASE}/kupony/${slug}`;
  const faq = getFAQ(capitalized);
  const relatedSlugs = getRelatedShops(baseSlug);
  const logoColor = COLORS[capitalized.charCodeAt(0) % COLORS.length];

  let coupons: any[] = [];
  try { coupons = await getCouponsByShop(shopName); } catch {}

  const codeCoupons = coupons.filter(c => c.code && c.code.trim() !== "");
  const dealCoupons = coupons.filter(c => !c.code || c.code.trim() === "");

  let shopDesc = "";
  try { shopDesc = await getShopDescription(capitalized, baseSlug); } catch {}

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Zlavickovo", "item": BASE },
          { "@type": "ListItem", "position": 2, "name": "Kupóny", "item": `${BASE}/obchody` },
          { "@type": "ListItem", "position": 3, "name": capitalized, "item": pageUrl },
        ],
      },
      {
        "@type": "ItemList",
        "name": `${capitalized} zľavové kódy ${year}`,
        "itemListElement": coupons.slice(0, 10).map((c: any, i: number) => ({
          "@type": "ListItem",
          "position": i + 1,
          "item": {
            "@type": "Offer",
            "name": c.title || c.name || `${capitalized} zľava`,
            "description": c.description || "",
            "url": c.affiliate_link || c.url || pageUrl,
            "seller": { "@type": "Organization", "name": capitalized },
          },
        })),
      },
      {
        "@type": "FAQPage",
        "mainEntity": faq.map(f => ({
          "@type": "Question",
          "name": f.q,
          "acceptedAnswer": { "@type": "Answer", "text": f.a },
        })),
      },
    ],
  };

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Nav />

      {/* Breadcrumb */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "12px 24px 0", fontSize: 12, color: "var(--text2)" }}>
        <a href="/" style={{ color: "var(--text2)", textDecoration: "none" }}>Zlavickovo</a>
        {" › "}
        <a href="/obchody" style={{ color: "var(--text2)", textDecoration: "none" }}>Kupóny</a>
        {" › "}
        <span style={{ color: "var(--text)" }}>{capitalized}</span>
      </div>

      {/* Header */}
      <div className="shop-header" style={{ background: "linear-gradient(180deg, #f5f3ff 0%, var(--bg) 100%)", padding: "48px 24px 40px", textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, margin: "0 auto 20px", background: logoColor, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 28, fontWeight: 800 }}>
          {capitalized.charAt(0)}
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-1px", margin: "0 0 12px", lineHeight: 1.2 }}>
          {capitalized} zľavové kódy a kupóny {month} {year}{isCz ? " (CZ)" : ""}
        </h1>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap", marginBottom: 20 }}>
          <span style={{ background: "#f0fdf4", color: "#16a34a", fontWeight: 600, fontSize: 13, padding: "4px 12px", borderRadius: 20 }}>
            ✓ {coupons.length} overených kupónov
          </span>
          <span style={{ background: "#fef9c3", color: "#a16207", fontWeight: 600, fontSize: 13, padding: "4px 12px", borderRadius: 20 }}>
            Aktualizované: {month} {year}
          </span>
        </div>

        {/* Shop description intro */}
        {shopDesc && (
          <div style={{ maxWidth: 700, margin: "0 auto", fontSize: 15, color: "var(--text2)", lineHeight: 1.7, textAlign: "left", background: "var(--step-bg)", borderRadius: 12, padding: "20px 24px" }}>
            {shopDesc}
          </div>
        )}
      </div>

      <style>{`
        @media(max-width:768px){
          .shop-cols{flex-direction:column!important}
          .shop-sidebar{display:none!important}
          .shop-sidebar-mobile{display:block!important}
          .coupon-grid{grid-template-columns:1fr!important}
          .related-grid{grid-template-columns:repeat(2,1fr)!important}
          .shop-main-pad{padding:24px 16px!important}
          .shop-header{padding:32px 16px 28px!important}
          .shop-header h1{font-size:22px!important;letter-spacing:-0.5px!important}
        }
      `}</style>

      <div className="shop-main-pad" style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px" }}>
        <div style={{ marginBottom: 40, display: "flex", justifyContent: "center" }}>
          <AdBanner slot="header" shopName={capitalized} />
        </div>

        <div className="shop-cols" style={{ display: "flex", gap: 32, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>

        {/* Code coupons section */}
        {codeCoupons.length > 0 && (
          <div style={{ marginBottom: 48 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 24px", letterSpacing: "-0.3px" }}>
              🏷️ Zľavové kódy ({codeCoupons.length})
            </h2>
            <div className="coupon-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
              {codeCoupons.map((coupon: any) => {
                const token = Buffer.from(`${capitalized}:${coupon.code}`).toString("base64");
                const { code: _s, ...couponData } = coupon;
                return <CouponCard key={coupon.id} coupon={couponData} token={token} />;
              })}
            </div>
          </div>
        )}

        {/* Deal coupons section (no code) */}
        {dealCoupons.length > 0 && (
          <div style={{ marginBottom: 48 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 24px", letterSpacing: "-0.3px" }}>
              🔥 Aktuálne akcie ({dealCoupons.length})
            </h2>
            <div className="coupon-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
              {dealCoupons.map((coupon: any) => {
                const { code: _s, ...couponData } = coupon;
                return <CouponCard key={coupon.id} coupon={couponData} token={null} />;
              })}
            </div>
          </div>
        )}

        {coupons.length > 0 && (
          <div style={{ marginBottom: 48, display: "flex", justifyContent: "center" }}>
            <AdBanner slot="between-coupons" shopName={capitalized} />
          </div>
        )}

        <Suspense fallback={
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", margin: "0 auto 16px", border: "3px solid #f0f0f0", borderTopColor: "#7C3AED", animation: "spin 0.8s linear infinite" }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#444" }}>AI hľadá kódy pre {capitalized}...</div>
            <div style={{ fontSize: 13, marginTop: 6, color: "#aaa" }}>Môže to trvať 10–20 sekúnd</div>
          </div>
        }>
          <AiCoupons shopName={`${capitalized}${isCz ? " CZ" : ""}`} />
        </Suspense>

        <div style={{ marginTop: 32 }}>
          <HeurekaWidget />
        </div>

        </div>{/* end left col */}

        {/* Sidebar – desktop */}
        <div className="shop-sidebar" style={{ width: 300, flexShrink: 0, position: "sticky", top: 72 }}>
          <div style={{ background: "var(--step-bg)", borderRadius: 16, padding: "20px" }}>
            <TopCodes shopFilter={capitalized} limit={5} title="🔥 Najpoužívanejšie kódy" />
          </div>
          <div style={{ marginTop: 16 }}>
            <AdBanner slot="sidebar" shopName={capitalized} />
          </div>
        </div>

        </div>{/* end shop-cols */}

        {/* Sidebar – mobile */}
        <div className="shop-sidebar-mobile" style={{ display: "none", marginTop: 32 }}>
          <TopCodes shopFilter={capitalized} limit={5} title="🔥 Najpoužívanejšie kódy" />
        </div>

        {/* Heureka widget */}
        <HeurekaSearch shopName={capitalized} />

        {/* FAQ */}
        <div style={{ marginTop: 48, padding: "40px", background: "var(--step-bg)", borderRadius: 20, border: "1px solid var(--step-border)" }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 28px", letterSpacing: "-0.3px", color: "var(--text)" }}>
            Časté otázky – {capitalized} kupóny
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {faq.map((item, i) => (
              <div key={i} style={{ padding: "20px 0", borderBottom: i < faq.length - 1 ? "1px solid var(--border)" : "none" }}>
                <div style={{ fontWeight: 600, fontSize: 15, color: "var(--text)", marginBottom: 8 }}>{item.q}</div>
                <div style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.6 }}>{item.a}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Related shops */}
        <div style={{ marginTop: 48 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 20px", letterSpacing: "-0.3px", color: "var(--text)" }}>
            Súvisiace obchody
          </h2>
          <div className="related-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {relatedSlugs.map(s => {
              const n = s.replace(/-/g, " ");
              const name = n.charAt(0).toUpperCase() + n.slice(1);
              const c = COLORS[name.charCodeAt(0) % COLORS.length];
              return (
                <a key={s} href={`/kupony/${s}`} style={{ textDecoration: "none" }}>
                  <div style={{ background: "var(--step-bg)", borderRadius: 12, padding: "16px", display: "flex", alignItems: "center", gap: 12, border: "1px solid var(--border)" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 9, background: c, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 15, flexShrink: 0 }}>
                      {name.charAt(0)}
                    </div>
                    <span style={{ fontWeight: 600, fontSize: 14, color: "var(--text)" }}>{name}</span>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
