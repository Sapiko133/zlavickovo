import { Suspense } from "react";
import { getCouponsByShop } from "@/lib/dognet";
import CouponCard from "@/components/CouponCard";
import AiCoupons from "@/components/AiCoupons";
import AdBanner from "@/components/AdBanner";

type Props = { params: Promise<{ slug: string }> };

function currentMonthYear() {
  const now = new Date();
  const month = new Intl.DateTimeFormat("sk-SK", { month: "long" }).format(now);
  return { month, year: now.getFullYear() };
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const isCz = slug.endsWith("-cz");
  const baseSlug = isCz ? slug.slice(0, -3) : slug;
  const name = baseSlug.replace(/-/g, " ");
  const shopName = name.charAt(0).toUpperCase() + name.slice(1);
  const { month, year } = currentMonthYear();
  const country = isCz ? "CZ" : "SK";

  return {
    title: `${shopName} zľavový kód ${month} ${year}`,
    description: `Aktuálne overené zľavové kódy pre ${shopName} ${country}. Ušetri na nákupe. Overené kupóny ${month} ${year}.`,
    openGraph: {
      title: `${shopName} zľavové kódy ${month} ${year}`,
      description: `Nájdi najlepšie kupóny pre ${shopName}. Overené kódy aktualizované denne.`,
    },
    ...(!isCz && {
      alternates: {
        languages: {
          sk: `https://zlavickovo.sk/kupony/${slug}`,
          cs: `https://zlavickovo.sk/kupony/${slug}-cz`,
        },
      },
    }),
  };
}

export default async function ShopPage({ params }: Props) {
  const { slug } = await params;
  const isCz = slug.endsWith("-cz");
  const baseSlug = isCz ? slug.slice(0, -3) : slug;
  const shopName = baseSlug.replace(/-/g, " ");
  const capitalized = shopName.charAt(0).toUpperCase() + shopName.slice(1);
  const country = isCz ? "cz" : "sk";
  const { month, year } = currentMonthYear();

  let coupons: any[] = [];
  try {
    coupons = await getCouponsByShop(shopName);
  } catch {}

  // JSON-LD structured data
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": `${capitalized} zľavové kódy ${year}`,
    "description": `Overené zľavové kódy pre ${capitalized}`,
    "itemListElement": coupons.slice(0, 10).map((coupon: any, i: number) => ({
      "@type": "ListItem",
      "position": i + 1,
      "item": {
        "@type": "Offer",
        "name": coupon.title || coupon.name || `${capitalized} zľava`,
        "description": coupon.description || "",
        "validThrough": coupon.valid_to || undefined,
        "url": coupon.affiliate_link || coupon.url || `https://zlavickovo.sk/kupony/${slug}`,
        "seller": { "@type": "Organization", "name": capitalized },
      },
    })),
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
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: "linear-gradient(135deg, #7C3AED, #2563EB)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 14, fontWeight: 800,
          }}>Z</div>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Zlavickovo</span>
        </a>
        <a href="/" style={{ fontSize: 13, color: "#7C3AED", textDecoration: "none" }}>← Späť</a>
      </nav>

      {/* Header */}
      <div style={{ background: "linear-gradient(180deg, #f5f3ff 0%, #fff 100%)", padding: "60px 24px 48px", textAlign: "center" }}>
        <div style={{
          width: 64, height: 64, borderRadius: 16, margin: "0 auto 20px",
          background: "linear-gradient(135deg, #7C3AED, #2563EB)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontSize: 28, fontWeight: 800,
        }}>
          {capitalized.charAt(0)}
        </div>
        <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-1px", margin: "0 0 8px" }}>
          {capitalized}
        </h1>
        <p style={{ color: "#666", fontSize: 15, margin: 0 }}>
          Aktuálne zľavové kódy a kupóny {month} {year}{isCz ? " (CZ)" : ""}
        </p>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px" }}>
        {/* Ad banner – header slot */}
        <div style={{ marginBottom: 40, display: "flex", justifyContent: "center" }}>
          <AdBanner slot="header" />
        </div>

        {/* Dognet coupons */}
        {coupons.length > 0 && (
          <div style={{ marginBottom: 48 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 24px", letterSpacing: "-0.3px" }}>
              Overené kupóny ({coupons.length})
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
              {coupons.map((coupon: any) => {
                const token = coupon.code
                  ? Buffer.from(`${capitalized}:${coupon.code}`).toString("base64")
                  : null;
                const { code: _stripped, ...couponData } = coupon;
                return <CouponCard key={coupon.id} coupon={couponData} token={token} />;
              })}
            </div>
          </div>
        )}

        {/* Ad banner – between coupons */}
        {coupons.length > 0 && (
          <div style={{ marginBottom: 48, display: "flex", justifyContent: "center" }}>
            <AdBanner slot="between-coupons" />
          </div>
        )}

        {/* AI coupons */}
        <Suspense fallback={
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{
              width: 40, height: 40, borderRadius: "50%", margin: "0 auto 16px",
              border: "3px solid #f0f0f0", borderTopColor: "#7C3AED",
              animation: "spin 0.8s linear infinite",
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#444" }}>AI hľadá kódy pre {capitalized}...</div>
            <div style={{ fontSize: 13, marginTop: 6, color: "#aaa" }}>Môže to trvať 10–20 sekúnd</div>
          </div>
        }>
          <AiCoupons shopName={`${capitalized}${isCz ? " CZ" : ""}`} />
        </Suspense>
      </div>

      {/* Footer */}
      <div style={{ borderTop: "1px solid #f0f0f0", padding: "32px 48px", textAlign: "center", fontSize: 13, color: "#999" }}>
        © 2026 Zlavickovo
      </div>
    </div>
  );
}
