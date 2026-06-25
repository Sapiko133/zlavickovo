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
    title: `${capitalized} zľavové kódy a kupóny 2026`,
    description: `Aktuálne overené zľavové kódy pre ${capitalized}. Ušetri na každom nákupe!`,
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
    <main style={{ fontFamily: "system-ui, sans-serif", minHeight: "100vh", background: "#f7f7f7" }}>
      <nav style={{ background: "#E8001D", padding: "0 24px", height: 60, display: "flex", alignItems: "center" }}>
        <a href="/" style={{ color: "#fff", fontWeight: 900, fontSize: 20, textDecoration: "none" }}>
          ✂️ KupónyZľavy.sk
        </a>
      </nav>

      <div style={{ background: "linear-gradient(135deg, #1a1a2e, #16213e)", padding: "40px 24px", textAlign: "center" }}>
        <h1 style={{ color: "#fff", fontSize: 28, fontWeight: 900, margin: "0 0 8px" }}>
          {capitalized} – zľavové kódy 2026
        </h1>
        <p style={{ color: "#aaa", margin: 0, fontSize: 15 }}>
          Aktuálne kupóny a promo kódy pre {capitalized}
        </p>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 20px" }}>
        {coupons.length > 0 && (
          <>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginBottom: 20 }}>
              ✅ Overené kupóny ({coupons.length})
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 18, marginBottom: 40 }}>
              {coupons.map((coupon: any) => (
                <CouponCard key={coupon.id} coupon={coupon} />
              ))}
            </div>
          </>
        )}

        <AiCoupons shopName={capitalized} />
      </div>
    </main>
  );
}