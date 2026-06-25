import { getCouponsByShop } from "@/lib/dognet";
import CouponCard from "@/components/CouponCard";
import AiCoupons from "@/components/AiCoupons";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const name = slug.replace(/-/g, " ");
  const capitalized = name.charAt(0).toUpperCase() + name.slice(1);
  return {
    title: `${capitalized} – zľavové kódy a kupóny 2026`,
    description: `Aktuálne overené zľavové kódy pre ${capitalized}. Ušetri na každom nákupe s AI vyhľadávaním kupónov.`,
    openGraph: {
      title: `${capitalized} zľavové kódy 2026`,
      description: `Nájdi najlepšie kupóny pre ${capitalized}. Overené kódy aktualizované denne.`,
    },
  };
}

export default async function ShopPage({ params }: Props) {
  const { slug } = await params;
  const shopName = slug.replace(/-/g, " ");
  const capitalized = shopName.charAt(0).toUpperCase() + shopName.slice(1);

  let coupons: any[] = [];
  try {
    coupons = await getCouponsByShop(shopName);
  } catch (e) {}

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", minHeight: "100vh", background: "#fff", color: "#1d1d1f" }}>
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

      <div style={{
        background: "linear-gradient(180deg, #f5f3ff 0%, #fff 100%)",
        padding: "60px 24px 48px", textAlign: "center",
      }}>
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
          Aktuálne zľavové kódy a kupóny 2026
        </p>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px" }}>
        {coupons.length > 0 && (
          <div style={{ marginBottom: 48 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 24px", letterSpacing: "-0.3px" }}>
              Overene kupony ({coupons.length})
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
              {coupons.map((coupon: any) => (
                <CouponCard key={coupon.id} coupon={coupon} />
              ))}
            </div>
          </div>
        )}
        <AiCoupons shopName={capitalized} />
      </div>

      <div style={{ borderTop: "1px solid #f0f0f0", padding: "24px 48px", textAlign: "center", fontSize: 13, color: "#999" }}>
        Affiliate linky – za nákupy cez náš web dostávame províziu · © 2026 Zlavickovo
      </div>
    </div>
  );
}
