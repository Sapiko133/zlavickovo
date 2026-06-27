import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "O nás | Zlavickovo.sk",
  description: "Zlavickovo je slovenský AI kupónový portál. Automaticky vyhľadávame aktuálne zľavové kódy pre 100+ obchodov.",
  alternates: { canonical: "https://zlavickovo.sk/o-nas" },
};

const FACTS = [
  { icon: "🤖", title: "AI vyhľadávanie",    desc: "Naša AI prehľadáva internet v reálnom čase a hľadá overené zľavové kódy." },
  { icon: "🏪", title: "100+ obchodov",       desc: "Sledujeme kupóny pre viac ako 100 slovenských a českých e-shopov." },
  { icon: "🇸🇰", title: "SK + CZ trh",        desc: "Pôsobíme na slovenskom aj českom trhu s lokálnymi zľavami." },
  { icon: "✅", title: "Overené kódy",         desc: "Každý kód je automaticky overovaný pred zverejnením." },
];

export default function ONasPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "'Inter', system-ui, sans-serif", color: "var(--text)" }}>

      <Nav />

      {/* Hero */}
      <div style={{ background: "linear-gradient(180deg, #f5f3ff 0%, var(--bg) 100%)", padding: "64px 24px 56px", textAlign: "center" }}>
        <div style={{ width: 72, height: 72, borderRadius: 20, margin: "0 auto 24px", background: "linear-gradient(135deg, #7C3AED, #2563EB)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 32, fontWeight: 800 }}>Z</div>
        <h1 style={{ fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 800, letterSpacing: "-1.5px", margin: "0 0 16px", color: "var(--text)" }}>O nás</h1>
        <p style={{ fontSize: 18, color: "var(--text2)", maxWidth: 580, margin: "0 auto", lineHeight: 1.7 }}>
          Zlavickovo je slovenský kupónový portál poháňaný AI. Automaticky vyhľadávame aktuálne zľavové kódy pre 100+ obchodov.
        </p>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "64px 24px" }}>

        {/* Fakty */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20, marginBottom: 64 }}>
          {FACTS.map((f, i) => (
            <div key={i} style={{ background: "var(--step-bg)", borderRadius: 16, padding: "28px 24px", border: "1px solid var(--step-border)", textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>{f.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)", marginBottom: 8 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>

        {/* Popis */}
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.5px", margin: "0 0 20px", color: "var(--text)" }}>Čo robíme</h2>
          <p style={{ fontSize: 15, color: "var(--text2)", lineHeight: 1.8, margin: "0 0 16px" }}>
            Naša AI automaticky vyhľadáva a overuje zľavové kódy z viacerých zdrojov — affiliate sietí, obchodných partnerov
            aj verejne dostupných stránok. Výsledky sú pravidelne aktualizované, aby ste mali vždy k dispozícii platné kupóny.
          </p>
          <p style={{ fontSize: 15, color: "var(--text2)", lineHeight: 1.8, margin: "0 0 16px" }}>
            Okrem promo kódov poskytujeme aj cashback program, letákové akcie supermarketov a prehľad najpopulárnejších
            obchodov na slovenskom a českom trhu.
          </p>
          <p style={{ fontSize: 15, color: "var(--text2)", lineHeight: 1.8, margin: "0 0 40px" }}>
            Portál je pre používateľov <strong>100% bezplatný</strong>. Prevádzkujeme ho vďaka affiliate provízii,
            ktorú dostávame od obchodov keď cez náš odkaz uskutočníte nákup.
          </p>

          <div style={{ background: "var(--step-bg)", borderRadius: 16, padding: "28px 28px", border: "1px solid rgba(124,58,237,0.15)" }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#7C3AED", marginBottom: 8 }}>Kontaktujte nás</div>
            <p style={{ fontSize: 14, color: "var(--text2)", margin: 0, lineHeight: 1.7 }}>
              Máte otázky, chcete inzerovať alebo hlásiť nefunkčný kód?<br />
              Napíšte nám: <a href="mailto:info@zlavickovo.sk" style={{ color: "#7C3AED", fontWeight: 600 }}>info@zlavickovo.sk</a>
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
