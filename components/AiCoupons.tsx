import { getAiCoupons } from "@/lib/ai-search";
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

  if (apiError || codes.length === 0) {
    // Žiadna Heureka CTA tu — kanonický Heureka prvok je jediný HeurekaWidget nižšie na stránke.
    return (
      <div style={{ padding: "12px 0" }}>
        <p style={{ fontSize: 14, color: "#666", margin: 0, lineHeight: 1.55 }}>
          AI momentálne nenašla ďalšie kódy pre {shopName}. Ceny od overených predajcov si môžeš porovnať nižšie.
        </p>
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

    </div>
  );
}
