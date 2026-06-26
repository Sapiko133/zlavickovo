import { LETAKY, getExpiryDate, formatDate, isExpiringSoon } from "@/lib/letaky";
import Footer from "@/components/Footer";
import type { Metadata } from "next";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Aktuálne letáky supermarketov",
  description: "Aktuálne týždenné letáky Lidl, Kaufland, Tesco, Billa a ďalších obchodov. Nájdi najlepšie akcie a zľavy.",
  alternates: { canonical: "https://zlavickovo.sk/letaky" },
  openGraph: {
    title: "Aktuálne letáky supermarketov | Zlavickovo",
    description: "Týždenné letáky Lidl, Kaufland, Tesco, Billa a ďalšie. Aktualizované automaticky.",
    url: "https://zlavickovo.sk/letaky",
    type: "website",
    locale: "sk_SK",
  },
};

const SK = LETAKY.filter(l => l.country === "sk");
const CZ = LETAKY.filter(l => l.country === "cz");

function LetatCard({ letak }: { letak: typeof LETAKY[0] }) {
  const expiry = getExpiryDate(letak.newDayOfWeek);
  const expiringSoon = isExpiringSoon(expiry);

  return (
    <div style={{
      background: "#fff", borderRadius: 16, border: "1px solid #f0f0f0",
      boxShadow: "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden",
    }}>
      <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid #f5f5f5" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12, background: letak.color, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: letak.color === "#FFCC00" ? "#333" : "#fff", fontWeight: 900, fontSize: 20,
            boxShadow: `0 4px 12px ${letak.color}44`,
          }}>
            {letak.letter}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#1d1d1f" }}>{letak.name}</div>
            <div style={{ fontSize: 12, color: "#aaa", marginTop: 2 }}>Platný do {formatDate(expiry)}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: letak.country === "sk" ? "#dbeafe" : "#fce7f3", color: letak.country === "sk" ? "#1d4ed8" : "#be185d" }}>
              {letak.country.toUpperCase()}
            </span>
            {expiringSoon && (
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: "#fee2e2", color: "#dc2626" }}>
                Expiruje čoskoro!
              </span>
            )}
          </div>
        </div>
        <div style={{ fontSize: 12, color: "#888" }}>Aktualizácia: {letak.updateText}</div>
      </div>
      <div style={{ padding: "14px 20px", display: "flex", gap: 8 }}>
        <a
          href={`/letaky/${letak.slug}`}
          style={{ flex: 1, padding: "10px", borderRadius: 9, border: "1.5px solid #e5e7eb", fontSize: 13, fontWeight: 600, color: "#555", textAlign: "center", textDecoration: "none" }}
        >
          Info
        </a>
        <a
          href={letak.url}
          target="_blank"
          rel="nofollow noopener noreferrer"
          style={{ flex: 2, padding: "10px", borderRadius: 9, background: "linear-gradient(135deg, #7C3AED, #2563EB)", fontSize: 13, fontWeight: 700, color: "#fff", textAlign: "center", textDecoration: "none" }}
        >
          Zobraziť leták →
        </a>
      </div>
    </div>
  );
}

export default function LetakyPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#fff", fontFamily: "'Inter', system-ui, sans-serif", color: "#1d1d1f" }}>
      {/* Nav */}
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 48px", height: 56, position: "sticky", top: 0, zIndex: 100, background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "#1d1d1f" }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #7C3AED, #2563EB)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, fontWeight: 800 }}>Z</div>
          <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: "-0.3px" }}>Zlavickovo</span>
        </a>
        <div style={{ display: "flex", gap: 28, fontSize: 13, color: "#555" }}>
          <a href="/obchody" style={{ color: "#555", textDecoration: "none" }}>Obchody</a>
          <a href="/letaky" style={{ color: "#7C3AED", fontWeight: 600, textDecoration: "none" }}>Letáky</a>
          <a href="/cashback" style={{ color: "#555", textDecoration: "none" }}>Cashback</a>
          <a href="/" style={{ color: "#555", textDecoration: "none" }}>Domov</a>
        </div>
      </nav>

      {/* Header */}
      <div style={{ background: "linear-gradient(180deg, #f5f3ff 0%, #fff 100%)", padding: "60px 24px 48px", textAlign: "center" }}>
        <h1 style={{ fontSize: "clamp(28px, 5vw, 48px)", fontWeight: 800, letterSpacing: "-1px", margin: "0 0 12px" }}>
          Aktuálne letáky
        </h1>
        <p style={{ color: "#666", fontSize: 16, margin: 0 }}>
          Týždenné letáky supermarketov – aktualizované automaticky
        </p>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px 80px" }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 20px" }}>Slovensko 🇸🇰</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16, marginBottom: 48 }}>
          {SK.map(l => <LetatCard key={l.slug} letak={l} />)}
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 20px" }}>Česko 🇨🇿</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {CZ.map(l => <LetatCard key={l.slug} letak={l} />)}
        </div>
      </div>

      <Footer />
    </div>
  );
}
