import { getShops } from "@/lib/dognet";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import type { Metadata } from "next";

const FALLBACK_SHOPS = [
  "Alza","Shein","Zalando","Mall","Notino","Sportisimo",
  "IKEA","Dedoles","Martinus","About You","Answear","Dr. Max",
  "Zara","H&M","ASOS","Lidl","Kaufland","Booking.com","GymBeam","Nike",
].map((name, i) => ({ id: -(i + 1), name, count: 0 }));

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Všetky obchody",
  description: "Prehľad všetkých obchodov so zľavovými kódmi a kupónmi. Nájdi kupóny pre tvoj obľúbený eshop.",
};

const COLORS = ["#E8001D", "#0065BD", "#00A551", "#FF6900", "#22C55E", "#003580", "#D32F2F", "#FF4081", "#006A35", "#8B1A1A"];

function shopColor(name: string) {
  return COLORS[name.charCodeAt(0) % COLORS.length];
}

function shopSlug(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-");
}

export default async function ObchodyPage() {
  let shops: { id: number; name: string; count: number }[] = [];
  try {
    const fetched = await getShops();
    shops = fetched.length > 0 ? fetched : FALLBACK_SHOPS;
  } catch {
    shops = FALLBACK_SHOPS;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#fff", fontFamily: "'Inter', system-ui, sans-serif", color: "#1d1d1f" }}>
      <Nav />

      {/* Header */}
      <div style={{ background: "#F0FDF4", borderBottom: "1px solid #BBF7D0", padding: "60px 24px 48px", textAlign: "center" }}>
        <h1 style={{ fontSize: "clamp(28px, 5vw, 48px)", fontWeight: 800, letterSpacing: "-1px", margin: "0 0 12px" }}>
          Všetky obchody
        </h1>
        <p style={{ color: "#555", fontSize: 16, margin: 0 }}>
          {shops.length} obchodov so zľavovými kódmi
        </p>
      </div>

      {/* Shop grid */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px 80px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
          {shops.map(shop => {
            const color = shopColor(shop.name);
            return (
              <a
                key={shop.id}
                href={`/kupony/${shopSlug(shop.name)}`}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center",
                  gap: 12, padding: "24px 16px", borderRadius: 16,
                  background: "#fff", border: "1px solid #e5e7eb",
                  textDecoration: "none", color: "#1d1d1f",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                }}
                onMouseEnter={(e: any) => { e.currentTarget.style.borderColor = "#22C55E"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(34,197,94,0.12)"; }}
                onMouseLeave={(e: any) => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)"; }}
              >
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: color,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontWeight: 800, fontSize: 20,
                  boxShadow: `0 4px 12px ${color}44`,
                }}>
                  {shop.name.charAt(0).toUpperCase()}
                </div>
                <span style={{ fontSize: 13, fontWeight: 500, color: "#444", textAlign: "center", lineHeight: 1.3 }}>
                  {shop.name}
                </span>
                {shop.count > 0 && (
                  <span style={{
                    fontSize: 11, color: "#16A34A", fontWeight: 600,
                    background: "#F0FDF4", padding: "2px 8px", borderRadius: 100,
                  }}>
                    {shop.count} {shop.count === 1 ? "kód" : shop.count < 5 ? "kódy" : "kódov"}
                  </span>
                )}
              </a>
            );
          })}
        </div>
      </div>

      <Footer />
    </div>
  );
}
