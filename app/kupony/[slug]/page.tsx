import { Suspense } from "react";
import { getCouponsByShop } from "@/lib/dognet";
import CouponCard from "@/components/CouponCard";
import AiCoupons from "@/components/AiCoupons";
import AdBanner from "@/components/AdBanner";
import TopCodes from "@/components/TopCodes";

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

export default async function ShopPage({ params }: Props) {
  const { slug } = await params;
  const isCz = slug.endsWith("-cz");
  const baseSlug = isCz ? slug.slice(0, -3) : slug;
  const shopName = baseSlug.replace(/-/g, " ");
  const capitalized = shopName.charAt(0).toUpperCase() + shopName.slice(1);
  const { month, year } = currentMonthYear();
  const pageUrl = `${BASE}/kupony/${slug}`;
  const faq = getFAQ(capitalized);

  let coupons: any[] = [];
  try { coupons = await getCouponsByShop(shopName); } catch {}

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
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", minHeight: "100vh", background: "#fff", color: "#1d1d1f" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Nav */}
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 48px", height: 56, position: "sticky", top: 0, zIndex: 100,
        background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(0,0,0,0.08)",
      }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "#1d1d1f" }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #7C3AED, #2563EB)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, fontWeight: 800 }}>Z</div>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Zlavickovo</span>
        </a>
        <div style={{ display: "flex", gap: 20, fontSize: 13 }}>
          <a href="/obchody" style={{ color: "#555", textDecoration: "none" }}>Obchody</a>
          <a href="/letaky" style={{ color: "#555", textDecoration: "none" }}>Letáky</a>
          <a href="/" style={{ color: "#7C3AED", textDecoration: "none" }}>← Domov</a>
        </div>
      </nav>

      {/* Breadcrumb */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "12px 24px 0", fontSize: 12, color: "#aaa" }}>
        <a href="/" style={{ color: "#aaa", textDecoration: "none" }}>Zlavickovo</a>
        {" › "}
        <a href="/obchody" style={{ color: "#aaa", textDecoration: "none" }}>Kupóny</a>
        {" › "}
        <span style={{ color: "#555" }}>{capitalized}</span>
      </div>

      {/* Header */}
      <div style={{ background: "linear-gradient(180deg, #f5f3ff 0%, #fff 100%)", padding: "48px 24px 40px", textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, margin: "0 auto 20px", background: "linear-gradient(135deg, #7C3AED, #2563EB)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 28, fontWeight: 800 }}>
          {capitalized.charAt(0)}
        </div>
        <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-1px", margin: "0 0 8px" }}>
          {capitalized}
        </h1>
        <p style={{ color: "#666", fontSize: 15, margin: 0 }}>
          Aktuálne zľavové kódy a kupóny {month} {year}{isCz ? " (CZ)" : ""}
        </p>
      </div>

      <style>{`@media(max-width:768px){.shop-cols{flex-direction:column!important}.shop-sidebar{display:none!important}.shop-sidebar-mobile{display:block!important}}`}</style>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px" }}>
        <div style={{ marginBottom: 40, display: "flex", justifyContent: "center" }}>
          <AdBanner slot="header" />
        </div>

        <div className="shop-cols" style={{ display: "flex", gap: 32, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>

        {coupons.length > 0 && (
          <div style={{ marginBottom: 48 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 24px", letterSpacing: "-0.3px" }}>
              Overené kupóny ({coupons.length})
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
              {coupons.map((coupon: any) => {
                const token = coupon.code ? Buffer.from(`${capitalized}:${coupon.code}`).toString("base64") : null;
                const { code: _s, ...couponData } = coupon;
                return <CouponCard key={coupon.id} coupon={couponData} token={token} />;
              })}
            </div>
          </div>
        )}

        {coupons.length > 0 && (
          <div style={{ marginBottom: 48, display: "flex", justifyContent: "center" }}>
            <AdBanner slot="between-coupons" />
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

        </div>{/* end left col */}

        {/* Sidebar – desktop */}
        <div className="shop-sidebar" style={{ width: 300, flexShrink: 0, position: "sticky", top: 72 }}>
          <div style={{ background: "#fafafa", borderRadius: 16, padding: "20px" }}>
            <TopCodes shopFilter={capitalized} limit={5} title="🔥 Najpoužívanejšie kódy" />
          </div>
          <div style={{ marginTop: 16 }}>
            <AdBanner slot="sidebar" />
          </div>
        </div>

        </div>{/* end shop-cols */}

        {/* Sidebar – mobile */}
        <div className="shop-sidebar-mobile" style={{ display: "none", marginTop: 32 }}>
          <TopCodes shopFilter={capitalized} limit={5} title="🔥 Najpoužívanejšie kódy" />
        </div>

        {/* FAQ */}
        <div style={{ marginTop: 64, padding: "40px", background: "#fafafa", borderRadius: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 28px", letterSpacing: "-0.3px" }}>
            Časté otázky – {capitalized} kupóny
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {faq.map((item, i) => (
              <div key={i} style={{ padding: "20px 0", borderBottom: i < faq.length - 1 ? "1px solid #ebebeb" : "none" }}>
                <div style={{ fontWeight: 600, fontSize: 15, color: "#1d1d1f", marginBottom: 8 }}>{item.q}</div>
                <div style={{ fontSize: 14, color: "#666", lineHeight: 1.6 }}>{item.a}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ borderTop: "1px solid #f0f0f0", padding: "32px 48px", textAlign: "center", fontSize: 13, color: "#999" }}>
        © 2026 Zlavickovo
      </div>
    </div>
  );
}
