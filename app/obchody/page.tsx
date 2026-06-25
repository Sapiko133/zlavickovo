import { getShops } from "@/lib/dognet";
import type { Metadata } from "next";

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
    shops = await getShops();
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
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "#1d1d1f" }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: "linear-gradient(135deg, #7C3AED, #2563EB)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 14, fontWeight: 800,
          }}>Z</div>
          <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: "-0.3px" }}>Zlavickovo</span>
        </a>
        <div style={{ display: "flex", gap: 28, fontSize: 13, color: "#555" }}>
          <a href="/#obchody" style={{ color: "#555", textDecoration: "none" }}>Obchody</a>
          <a href="/#zlavy" style={{ color: "#555", textDecoration: "none" }}>Zľavy</a>
          <a href="/" style={{ color: "#555", textDecoration: "none" }}>Domov</a>
        </div>
      </nav>

      {/* Header */}
      <div style={{
        background: "linear-gradient(180deg, #f5f3ff 0%, #fff 100%)",
        padding: "60px 24px 48px", textAlign: "center",
      }}>
        <h1 style={{ fontSize: "clamp(28px, 5vw, 48px)", fontWeight: 800, letterSpacing: "-1px", margin: "0 0 12px" }}>
          Všetky obchody
        </h1>
        <p style={{ color: "#666", fontSize: 16, margin: 0 }}>
          {shops.length > 0 ? `${shops.length} obchodov so zľavovými kódmi` : "Načítavam obchody..."}
        </p>
      </div>

      {/* Shop grid */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px 80px" }}>
        {shops.length > 0 ? (
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
                  <span style={{
                    fontSize: 11, color: "#7C3AED", fontWeight: 600,
                    background: "rgba(124,58,237,0.08)", padding: "2px 8px", borderRadius: 100,
                  }}>
                    {shop.count} {shop.count === 1 ? "kód" : shop.count < 5 ? "kódy" : "kódov"}
                  </span>
                </a>
              );
            })}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "64px 24px", color: "#aaa", fontSize: 15 }}>
            Nepodarilo sa načítať obchody. Skúste to neskôr.
          </div>
        )}
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
