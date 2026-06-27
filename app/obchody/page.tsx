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

const COLORS = ["#E8001D", "#0065BD", "#00A551", "#FF6900", "#7B2FBE", "#003580", "#D32F2F", "#FF4081", "#006A35", "#8B1A1A"];

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
      <div style={{
        background: "linear-gradient(180deg, #f5f3ff 0%, #fff 100%)",
        padding: "60px 24px 48px", textAlign: "center",
      }}>
        <h1 style={{ fontSize: "clamp(28px, 5vw, 48px)", fontWeight: 800, letterSpacing: "-1px", margin: "0 0 12px" }}>
          Všetky obchody
        </h1>
        <p style={{ color: "#666", fontSize: 16, margin: 0 }}>
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
                    background: "#fff", border: "1px solid #f0f0f0",
                    textDecoration: "none", color: "#1d1d1f",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                    position: "relative",
                  }}
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
                      fontSize: 11, color: "#7C3AED", fontWeight: 600,
                      background: "rgba(124,58,237,0.08)", padding: "2px 8px", borderRadius: 100,
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
