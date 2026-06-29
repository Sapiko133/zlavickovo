import { getAiCoupons } from "@/lib/ai-search";
import { normalizeShopSlug } from "@/lib/slug";
import AiCouponCard from "@/components/AiCouponCard";

export default async function AiCoupons({ shopName }: { shopName: string }) {
  let codes: any[] = [];
  let apiError = false;
  try {
    const result = await getAiCoupons(shopName);
    codes = result.codes || [];
  } catch {
    apiError = true;
  }

  const shopSlug = normalizeShopSlug(shopName);

  if (apiError || codes.length === 0) {
    return (
      <div style={{ padding: "20px 0" }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1d1d1f", marginBottom: 16 }}>
          🔍 Porovnajte cenu na Heureke
        </h2>
        <p style={{ fontSize: 14, color: "#666", margin: "0 0 16px", lineHeight: 1.5 }}>
          Nájdite najlepšie ceny od overených predajcov.
        </p>
        <a
          href={`https://www.heureka.sk/?h%5Bfraze%5D=${encodeURIComponent(shopName)}&utm_source=zlavickovo&utm_medium=referral&positionid=71010`}
          target="_blank"
          rel="noopener noreferrer nofollow"
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 24px", borderRadius: 10, background: "#22C55E", color: "#fff", fontWeight: 700, fontSize: 14, textDecoration: "none" }}
        >
          🔍 Porovnať na Heureke ↗
        </a>
      </div>
    );
  }

  const promoCodes = codes.filter(c => c.type === "promo_code" || (c.code && c.code !== "AKCIA"));
  const deals = codes.filter(c => c.type === "deal" || c.code === "AKCIA");

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1d1d1f", marginBottom: 16, letterSpacing: "-0.3px" }}>
        🤖 AI nájdené zľavy ({codes.length})
      </h2>

      {promoCodes.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#22C55E", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 12 }}>
            Promo kódy
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
            {promoCodes.map((code: any, i: number) => (
              <AiCouponCard key={i} code={code} shopName={shopName} type="promo" />
            ))}
          </div>
        </div>
      )}

      {deals.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 12 }}>
            Aktuálne akcie
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
            {deals.map((code: any, i: number) => (
              <AiCouponCard key={i} code={code} shopName={shopName} type="deal" />
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <a
          href={`https://www.heureka.sk/?h%5Bfraze%5D=${encodeURIComponent(shopName)}&utm_source=zlavickovo&utm_medium=referral&positionid=71010`}
          target="_blank"
          rel="noopener noreferrer nofollow"
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 9, background: "#F0FDF4", border: "1.5px solid #BBF7D0", color: "#16A34A", fontWeight: 700, fontSize: 13, textDecoration: "none" }}
        >
          🔍 Porovnajte aj na Heureke ↗
        </a>
      </div>
    </div>
  );
}
