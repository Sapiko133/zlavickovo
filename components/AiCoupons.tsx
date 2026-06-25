import { getAiCoupons } from "@/lib/ai-search";
import CouponCopyButton from "@/components/CouponCopyButton";

export default async function AiCoupons({ shopName }: { shopName: string }) {
  let codes: any[] = [];
  try {
    const result = await getAiCoupons(shopName);
    codes = result.codes || [];
  } catch (e) {}

  if (codes.length === 0) return (
    <div style={{ textAlign: "center", padding: "40px 24px" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: "#333", marginBottom: 6 }}>
        Nenašli sa kódy pre {shopName}
      </div>
      <div style={{ fontSize: 13, color: "#aaa" }}>
        Tento obchod momentálne nemá dostupné promo kódy.
      </div>
    </div>
  );

  const promoCodes = codes.filter(c => c.type === "promo_code" || (c.code && c.code !== "AKCIA"));
  const deals = codes.filter(c => c.type === "deal" || c.code === "AKCIA");

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1d1d1f", marginBottom: 20 }}>
        AI nájdené zľavy ({codes.length})
      </h2>

      {promoCodes.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#7C3AED", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>
            Promo kódy
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {promoCodes.map((code: any, i: number) => (
              <div key={i} style={{
                background: "#fff", borderRadius: 14,
                boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                border: "1px solid #eee", overflow: "hidden",
              }}>
                <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid #f0f0f0" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: "#1d1d1f" }}>{code.discount}</span>
                    <span style={{ fontSize: 11, background: "rgba(124,58,237,0.08)", color: "#7C3AED", fontWeight: 600, padding: "3px 8px", borderRadius: 6 }}>Promo kód</span>
                  </div>
                  <div style={{ fontSize: 13, color: "#666" }}>{code.description}</div>
                  {code.valid_until && (
                    <div style={{ fontSize: 12, color: "#aaa", marginTop: 4 }}>Vyprší: {code.valid_until}</div>
                  )}
                </div>
                <div style={{ padding: "12px 20px 16px" }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <div style={{
                      flex: 1, padding: "10px 14px", background: "#fafafa",
                      borderRadius: 8, border: "2px dashed #7C3AED",
                      fontWeight: 800, fontSize: 14, color: "#7C3AED",
                      letterSpacing: 2, textAlign: "center",
                    }}>
                      {code.code}
                    </div>
                    <CouponCopyButton code={code.code} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {deals.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>
            Aktuálne akcie
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {deals.map((code: any, i: number) => (
              <div key={i} style={{
                background: "#fff", borderRadius: 14,
                boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                border: "1px solid #eee", overflow: "hidden",
              }}>
                <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid #f0f0f0" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: "#1d1d1f" }}>{code.discount}</span>
                    <span style={{ fontSize: 11, background: "#f0fdf4", color: "#16a34a", fontWeight: 600, padding: "3px 8px", borderRadius: 6 }}>Akcia</span>
                  </div>
                  <div style={{ fontSize: 13, color: "#666" }}>{code.description}</div>
                  {code.valid_until && (
                    <div style={{ fontSize: 12, color: "#aaa", marginTop: 4 }}>Vyprší: {code.valid_until}</div>
                  )}
                </div>
                <div style={{ padding: "12px 20px 16px" }}>
                  <a
                    href={code.url || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "block", padding: "11px 14px", borderRadius: 8,
                      background: "#1d1d1f", color: "#fff", fontWeight: 700,
                      fontSize: 14, textAlign: "center", textDecoration: "none",
                    }}
                  >
                    Prejsť na akciu →
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
