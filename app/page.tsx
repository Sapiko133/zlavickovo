import SearchBar from "@/components/SearchBar";
import CouponCard from "@/components/CouponCard";
import { getLatestCoupons } from "@/lib/dognet";

export const revalidate = 3600;

const SHOPS = [
  { name: "Alza", color: "#0065BD", letter: "A" },
  { name: "Shein", color: "#E8001D", letter: "S" },
  { name: "Zalando", color: "#FF6900", letter: "Z" },
  { name: "Mall", color: "#E31837", letter: "M" },
  { name: "Notino", color: "#8B1A1A", letter: "N" },
  { name: "Sportisimo", color: "#00A551", letter: "S" },
  { name: "IKEA", color: "#0058A3", letter: "I" },
  { name: "Dedoles", color: "#FF4081", letter: "D" },
  { name: "Martinus", color: "#D32F2F", letter: "M" },
  { name: "About You", color: "#000000", letter: "A" },
  { name: "Answear", color: "#FF6B6B", letter: "A" },
  { name: "Dr. Max", color: "#006A35", letter: "D" },
];

export default async function Home() {
  let deals: any[] = [];
  try {
    deals = await getLatestCoupons(6);
  } catch (e) {}

  return (
    <div style={{ minHeight: "100vh", background: "#fff", fontFamily: "'Inter', system-ui, sans-serif", color: "#1d1d1f" }}>

      {/* Nav */}
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 48px", height: 56, position: "sticky", top: 0, zIndex: 100,
        background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(0,0,0,0.08)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: "linear-gradient(135deg, #7C3AED, #2563EB)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 14, fontWeight: 800,
          }}>Z</div>
          <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: "-0.3px" }}>Zlavickovo</span>
        </div>
        <div style={{ display: "flex", gap: 28, fontSize: 13, color: "#555" }}>
          <a href="#obchody" style={{ color: "#555", textDecoration: "none" }}>Obchody</a>
          <a href="#zlavy" style={{ color: "#555", textDecoration: "none" }}>Zľavy</a>
          <a href="#" style={{ color: "#555", textDecoration: "none" }}>Novinky</a>
        </div>
      </nav>

      {/* Hero */}
      <div style={{
        textAlign: "center",
        padding: "100px 24px 80px",
        background: "linear-gradient(180deg, #f5f3ff 0%, #eff6ff 50%, #fff 100%)",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: -100, left: "50%", transform: "translateX(-50%)",
          width: 800, height: 500,
          background: "radial-gradient(ellipse, rgba(124,58,237,0.12) 0%, rgba(37,99,235,0.08) 40%, transparent 70%)",
          pointerEvents: "none",
        }} />
        <div style={{
          display: "inline-block", padding: "6px 16px", borderRadius: 100,
          background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)",
          fontSize: 12, color: "#7C3AED", marginBottom: 28, fontWeight: 600, letterSpacing: "0.3px",
        }}>
          ✦ AI-powered kupónový portál
        </div>
        <h1 style={{
          fontSize: "clamp(36px, 6vw, 72px)", fontWeight: 800,
          letterSpacing: "-2px", lineHeight: 1.05, margin: "0 0 20px",
          color: "#1d1d1f",
        }}>
          Ušetri na{" "}
          <span style={{
            background: "linear-gradient(135deg, #7C3AED 0%, #2563EB 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            každom nákupe
          </span>
        </h1>
        <p style={{ fontSize: 18, color: "#666", maxWidth: 480, margin: "0 auto 48px", lineHeight: 1.6 }}>
          Zadaj obchod alebo produkt a AI nájde aktuálne zľavové kódy za pár sekúnd.
        </p>
        <SearchBar />
        <div style={{ display: "flex", gap: 24, justifyContent: "center", marginTop: 40, fontSize: 13, color: "#999" }}>
          <span>✓ Overené kódy</span>
          <span>✓ Aktualizované denne</span>
          <span>✓ 100% zadarmo</span>
        </div>
      </div>

      {/* Popular shops */}
      <div id="obchody" style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 24px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 36 }}>
          <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.5px", margin: 0 }}>Populárne obchody</h2>
          <a href="/obchody" style={{ fontSize: 13, color: "#7C3AED", textDecoration: "none" }}>Zobraziť všetky →</a>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
          {SHOPS.map(shop => (
            <a
              key={shop.name}
              href={"/kupony/" + shop.name.toLowerCase().replace(/ /g, "-")}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                gap: 12, padding: "24px 16px", borderRadius: 16,
                background: "#fff", border: "1px solid #f0f0f0",
                textDecoration: "none", color: "#1d1d1f",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              }}
            >
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: shop.color,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontWeight: 800, fontSize: 20,
                boxShadow: "0 4px 12px " + shop.color + "44",
              }}>
                {shop.letter}
              </div>
              <span style={{ fontSize: 13, fontWeight: 500, color: "#444" }}>{shop.name}</span>
            </a>
          ))}
        </div>
      </div>

      {/* Latest deals */}
      <div id="zlavy" style={{ background: "#fafafa", padding: "80px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 36 }}>
            <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.5px", margin: 0 }}>Najnovšie zľavy</h2>
            <span style={{ fontSize: 13, color: "#7C3AED" }}>Zobraziť všetky →</span>
          </div>
          {deals.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
              {deals.map((coupon: any) => (
                <CouponCard key={coupon.id} coupon={coupon} />
              ))}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "48px 24px", color: "#aaa", fontSize: 15 }}>
              Momentálne žiadne aktívne zľavy. Skúste vyhľadávanie.
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{
        borderTop: "1px solid #f0f0f0", padding: "32px 48px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        fontSize: 13, color: "#999",
      }}>
        <span style={{ fontWeight: 600, color: "#1d1d1f" }}>Zlavickovo</span>
        <span>Affiliate linky – za nákupy cez náš web dostávame províziu</span>
        <span>© 2026</span>
      </div>
    </div>
  );
}
