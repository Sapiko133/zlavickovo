import { LETAKY, getExpiryDate, formatDate, isExpiringSoon } from "@/lib/letaky";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import type { Metadata } from "next";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Aktuálne letáky supermarketov | Potraviny & Reťazce",
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
      background: "var(--card)", borderRadius: 16, border: "1px solid var(--border)",
      boxShadow: "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden",
    }}>
      <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid var(--border)" }}>
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
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{letak.name}</div>
            <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 2 }}>Platný do {formatDate(expiry)}</div>
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
        <div style={{ fontSize: 12, color: "var(--text2)" }}>Aktualizácia: {letak.updateText}</div>
      </div>
      <div style={{ padding: "14px 20px", display: "flex", gap: 8 }}>
        <a
          href={`/letaky/${letak.slug}`}
          style={{ flex: 1, padding: "10px", borderRadius: 9, border: "1.5px solid var(--border)", fontSize: 13, fontWeight: 600, color: "var(--text2)", textAlign: "center", textDecoration: "none" }}
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

function SectionHeader({ emoji, title, subtitle }: { emoji: string; title: string; subtitle: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
      <div style={{ fontSize: 32 }}>{emoji}</div>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "var(--text)" }}>{title}</h2>
        <p style={{ fontSize: 13, color: "var(--text2)", margin: 0 }}>{subtitle}</p>
      </div>
    </div>
  );
}

export default function LetakyPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "'Inter', system-ui, sans-serif", color: "var(--text)" }}>
      <Nav links={[
        { label: "Obchody", href: "/obchody" },
        { label: "🛒 Potraviny", href: "/letaky" },
        { label: "Cashback", href: "/cashback" },
        { label: "Blog", href: "/blog" },
      ]} />

      {/* Header */}
      <div style={{ background: "linear-gradient(180deg, #f5f3ff 0%, var(--bg) 100%)", padding: "60px 24px 48px", textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 100, background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)", fontSize: 12, color: "#7C3AED", marginBottom: 20, fontWeight: 600 }}>
          🛒 Potraviny & Reťazce
        </div>
        <h1 style={{ fontSize: "clamp(28px, 5vw, 48px)", fontWeight: 800, letterSpacing: "-1px", margin: "0 0 12px", color: "var(--text)" }}>
          Aktuálne letáky
        </h1>
        <p style={{ color: "var(--text2)", fontSize: 16, margin: 0 }}>
          Týždenné letáky supermarketov – aktualizované automaticky
        </p>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px 80px" }}>
        {/* SK section */}
        <div style={{ marginBottom: 56 }}>
          <SectionHeader emoji="🇸🇰" title="Slovensko — Potraviny & Reťazce" subtitle="Lidl, Kaufland, Tesco, Billa, COOP Jednota a ďalšie" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {SK.map(l => <LetatCard key={l.slug} letak={l} />)}
          </div>
        </div>

        {/* CZ section */}
        <div>
          <SectionHeader emoji="🇨🇿" title="Česko — Potraviny & Reťazce" subtitle="Penny, Albert, Globus a ďalšie" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {CZ.map(l => <LetatCard key={l.slug} letak={l} />)}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
