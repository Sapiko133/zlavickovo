import { Suspense } from "react";
import { getCouponsByShop } from "@/lib/dognet";
import { getShopDescription } from "@/lib/shop-desc";
import AiCoupons from "@/components/AiCoupons";
import AdBanner from "@/components/AdBanner";
import TopCodes from "@/components/TopCodes";
import HeurekaSearch from "@/components/HeurekaSearch";
import HeurekaWidget from "@/components/HeurekaWidget";
import ShopTabs from "@/components/ShopTabs";
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
  const seed = currentSlug.charCodeAt(0) + currentSlug.length;
  const start = seed % Math.max(1, others.length - count);
  return others.slice(start, start + count);
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const isCz = slug.endsWith("-cz");
  const baseSlug = isCz ? slug.slice(0, -3) : slug;
  const name = baseSlug.replace(/-/g, " ");
  const shopName = name.charAt(0).toUpperCase() + name.slice(1);
  const { month, year } = currentMonthYear();
  const pageUrl = `${BASE}/kupony/${slug}`;

  return {
    title: `${shopName} zľavový kód ${month} ${year} ✂️ Overené kupóny`,
    description: `✅ Aktuálne overené zľavové kódy pre ${shopName}. Ušetri na nákupe. Overené ${month} ${year}. Bez registrácie.`,
    alternates: {
      canonical: pageUrl,
      languages: isCz ? undefined : { sk: pageUrl, cs: `${BASE}/kupony/${slug}-cz` },
    },
    openGraph: {
      title: `${shopName} zľavové kódy ${month} ${year}`,
      description: `Nájdi najlepšie kupóny pre ${shopName}. Overené kódy aktualizované denne.`,
      url: pageUrl, type: "website", locale: "sk_SK",
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

  const rawCodeCoupons = coupons.filter(c => c.code && c.code.trim() !== "");
  const dealCoupons = coupons.filter(c => !c.code || c.code.trim() === "");

  // Embed token into coupon data, strip raw code for client
  const codeCoupons = rawCodeCoupons.map(c => {
    const { code, ...rest } = c;
    return { ...rest, _token: Buffer.from(`${capitalized}:${code}`).toString("base64") };
  });

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
        "@type": "FAQPage",
        "mainEntity": faq.map(f => ({
          "@type": "Question", "name": f.q,
          "acceptedAnswer": { "@type": "Answer", "text": f.a },
        })),
      },
    ],
  };

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", minHeight: "100vh", background: "#f7f8fa", color: "#1d1d1f" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Nav />

      {/* Breadcrumb */}
      <div style={{ background: "#fff", borderBottom: "1px solid #eaecf0" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "10px 24px", fontSize: 12, color: "#888" }}>
          <a href="/" style={{ color: "#888", textDecoration: "none" }}>Zlavickovo</a>
          {" › "}
          <a href="/obchody" style={{ color: "#888", textDecoration: "none" }}>Kupóny</a>
          {" › "}
          <span style={{ color: "#1d1d1f", fontWeight: 500 }}>{capitalized}</span>
        </div>
      </div>

      {/* Shop header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #eaecf0", padding: "28px 24px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 20 }}>
            <div style={{
              width: 72, height: 72, borderRadius: 18, background: logoColor, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontWeight: 800, fontSize: 30,
              boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            }}>
              {capitalized.charAt(0)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ fontSize: "clamp(20px, 3vw, 28px)", fontWeight: 800, margin: "0 0 10px", color: "#1d1d1f", letterSpacing: "-0.5px", lineHeight: 1.2 }}>
                {capitalized} zľavové kódy &amp; kupóny {month} {year}{isCz ? " (CZ)" : ""}
              </h1>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, background: "#dcfce7", color: "#16a34a", fontWeight: 700, padding: "4px 12px", borderRadius: 20 }}>
                  ✓ {coupons.length} overených kupónov
                </span>
                <span style={{ fontSize: 12, background: "#f1f5f9", color: "#475569", fontWeight: 600, padding: "4px 12px", borderRadius: 20 }}>
                  Aktualizované: {month} {year}
                </span>
                {isCz && (
                  <span style={{ fontSize: 12, background: "#dbeafe", color: "#1d4ed8", fontWeight: 600, padding: "4px 12px", borderRadius: 20 }}>CZ</span>
                )}
              </div>
              {shopDesc && (
                <p style={{ fontSize: 14, color: "#666", margin: "12px 0 0", lineHeight: 1.6, maxWidth: 640 }}>
                  {shopDesc.length > 220 ? shopDesc.slice(0, 220) + "..." : shopDesc}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media(max-width:768px){
          .shop-layout { flex-direction: column !important; }
          .shop-sidebar { display: none !important; }
          .shop-sidebar-mobile { display: block !important; }
          .related-grid { grid-template-columns: repeat(2,1fr) !important; }
        }
      `}</style>

      {/* Main layout */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px" }}>
        <div className="shop-layout" style={{ display: "flex", gap: 28, alignItems: "flex-start" }}>

          {/* Left column */}
          <div style={{ flex: 1, minWidth: 0 }}>

            {/* Ad banner */}
            <div style={{ marginBottom: 24, display: "flex", justifyContent: "center" }}>
              <AdBanner slot="header" shopName={capitalized} />
            </div>

            {/* Tabs with coupon rows */}
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #eaecf0", padding: "24px", marginBottom: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <ShopTabs
                capitalized={capitalized}
                codeCoupons={codeCoupons}
                dealCoupons={dealCoupons}
              />
            </div>

            {/* AI Coupons */}
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #eaecf0", padding: "24px", marginBottom: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <Suspense fallback={
                <div style={{ textAlign: "center", padding: "40px 20px" }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", margin: "0 auto 14px", border: "3px solid #f0f0f0", borderTopColor: "#7C3AED", animation: "spin 0.8s linear infinite" }} />
                  <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#555" }}>AI hľadá kódy pre {capitalized}...</div>
                  <div style={{ fontSize: 12, marginTop: 4, color: "#aaa" }}>Môže to trvať 10–20 sekúnd</div>
                </div>
              }>
                <AiCoupons shopName={`${capitalized}${isCz ? " CZ" : ""}`} />
              </Suspense>
            </div>

            {/* Heureka */}
            <div style={{ marginBottom: 24 }}>
              <HeurekaWidget />
            </div>
            <HeurekaSearch shopName={capitalized} />

            {/* Mobile sidebar */}
            <div className="shop-sidebar-mobile" style={{ display: "none", marginTop: 24 }}>
              <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #eaecf0", padding: "20px" }}>
                <TopCodes shopFilter={capitalized} limit={5} title="🔥 Najpoužívanejšie kódy" />
              </div>
            </div>
          </div>

          {/* Sidebar – desktop */}
          <div className="shop-sidebar" style={{ width: 272, flexShrink: 0, position: "sticky", top: 72, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #eaecf0", padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <TopCodes shopFilter={capitalized} limit={5} title="🔥 Najpoužívanejšie kódy" />
            </div>
            <AdBanner slot="sidebar" shopName={capitalized} />
          </div>
        </div>

        {/* FAQ */}
        <div style={{ marginTop: 40, background: "#fff", borderRadius: 14, border: "1px solid #eaecf0", padding: "32px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 24px", letterSpacing: "-0.3px", color: "#1d1d1f" }}>
            Časté otázky – {capitalized} kupóny
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

        {/* Related shops */}
        <div style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px", color: "#1d1d1f" }}>
            Súvisiace obchody
          </h2>
          <div className="related-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {relatedSlugs.map(s => {
              const n = s.replace(/-/g, " ");
              const name = n.charAt(0).toUpperCase() + n.slice(1);
              const c = COLORS[name.charCodeAt(0) % COLORS.length];
              return (
                <a key={s} href={`/kupony/${s}`} style={{ textDecoration: "none" }}>
                  <div style={{ background: "#fff", borderRadius: 10, padding: "14px 16px", display: "flex", alignItems: "center", gap: 10, border: "1px solid #eaecf0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: c, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                      {name.charAt(0)}
                    </div>
                    <span style={{ fontWeight: 600, fontSize: 13, color: "#1d1d1f" }}>{name}</span>
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
