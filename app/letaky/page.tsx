import { LETAKY, getExpiryDate, formatDate, isExpiringSoon } from "@/lib/letaky";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import ShopFavicon from "@/components/ShopFavicon";
import type { Metadata } from "next";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Aktuálne akcie supermarketov | Potraviny & Reťazce",
  description: "Aktuálne týždenné akcie Lidl, Kaufland, Tesco, Billa a ďalších obchodov. Nájdi najlepšie zľavy.",
  alternates: { canonical: "https://www.zlavickovo.sk/letaky" },
  openGraph: {
    title: "Aktuálne akcie supermarketov | Zlavickovo",
    description: "Týždenné akcie Lidl, Kaufland, Tesco, Billa a ďalšie. Aktualizované automaticky.",
    url: "https://www.zlavickovo.sk/letaky",
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
      background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb",
      boxShadow: "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden",
    }}>
      <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid #e5e7eb" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
          <ShopFavicon domain={letak.domain} name={letak.name} size={48} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#1d1d1f" }}>{letak.name}</div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>Platný do {formatDate(expiry)}</div>
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
        <div style={{ fontSize: 12, color: "#666" }}>Aktualizácia: {letak.updateText}</div>
      </div>
      <div style={{ padding: "14px 20px", display: "flex", gap: 8 }}>
        <a href={`/letaky/${letak.slug}`} style={{ flex: 1, padding: "10px", minHeight: 44, borderRadius: 9, border: "1.5px solid #e5e7eb", fontSize: 13, fontWeight: 600, color: "#666", textAlign: "center", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
          Info
        </a>
        <a
          href={letak.url}
          target="_blank"
          rel="nofollow noopener noreferrer"
          style={{ flex: 2, padding: "10px", minHeight: 44, borderRadius: 9, background: "#22C55E", fontSize: 13, fontWeight: 700, color: "#fff", textAlign: "center", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          Zobraziť leták →
        </a>
      </div>
    </div>
  );
}

function SectionHeader({ emoji, title, subtitle }: { emoji: string; title: string; subtitle: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
      <div style={{ fontSize: 32 }}>{emoji}</div>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "#1d1d1f" }}>{title}</h2>
        <p style={{ fontSize: 13, color: "#666", margin: 0 }}>{subtitle}</p>
      </div>
    </div>
  );
}

export default function LetakyPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#fff", fontFamily: "'Inter', system-ui, sans-serif", color: "#1d1d1f" }}>
      <style>{`@media(max-width:600px){ .letaky-main-grid { grid-template-columns: repeat(2,1fr) !important; gap: 10px !important; } }`}</style>
      <Nav />

      {/* Header */}
      <div style={{ background: "#F0FDF4", borderBottom: "1px solid #BBF7D0", padding: "60px 24px 48px", textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 100, background: "rgba(34,197,94,0.12)", border: "1px solid #BBF7D0", fontSize: 12, color: "#16A34A", marginBottom: 20, fontWeight: 600 }}>
          Aktuálne letáky
        </div>
        <h1 style={{ fontSize: "clamp(28px, 5vw, 48px)", fontWeight: 800, letterSpacing: "-1px", margin: "0 0 12px", color: "#1d1d1f" }}>
          🛒 Letáky supermarketov
        </h1>
        <p style={{ color: "#555", fontSize: 16, margin: 0 }}>
          Týždenné letáky supermarketov – každý týždeň nové
        </p>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px 80px" }}>
        <div style={{ marginBottom: 56 }}>
          <SectionHeader emoji="🇸🇰" title="Slovensko — Potraviny & Reťazce" subtitle="Lidl, Kaufland, Tesco, Billa, COOP Jednota a ďalšie" />
          <div className="letaky-main-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {SK.map(l => <LetatCard key={l.slug} letak={l} />)}
          </div>
        </div>

        <div>
          <SectionHeader emoji="🇨🇿" title="Česko — Potraviny & Reťazce" subtitle="Penny, Albert, Globus a ďalšie" />
          <div className="letaky-main-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {CZ.map(l => <LetatCard key={l.slug} letak={l} />)}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
