import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ochrana súkromia | Zlavickovo.sk",
  description: "Zásady ochrany osobných údajov portálu Zlavickovo.sk. GDPR, cookies, affiliate linky.",
  alternates: { canonical: "https://zlavickovo.sk/privacy" },
};

const UPDATED = "26. 6. 2026";

export default function PrivacyPage() {
  const h2: React.CSSProperties = { fontSize: 20, fontWeight: 700, color: "#1d1d1f", margin: "40px 0 12px", letterSpacing: "-0.3px" };
  const p: React.CSSProperties = { fontSize: 15, color: "#555", lineHeight: 1.8, margin: "0 0 12px" };
  const li: React.CSSProperties = { fontSize: 15, color: "#555", lineHeight: 1.8 };

  return (
    <div style={{ minHeight: "100vh", background: "#fff", fontFamily: "'Inter', system-ui, sans-serif", color: "#1d1d1f" }}>

      <Nav />

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "56px 24px 80px" }}>
        <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-1px", margin: "0 0 8px", color: "#1d1d1f" }}>Ochrana súkromia</h1>
        <p style={{ fontSize: 13, color: "#aaa", margin: "0 0 48px" }}>Aktualizované: {UPDATED}</p>

        <h2 style={h2}>1. Aké údaje zbierame</h2>
        <p style={p}>Zlavickovo.sk zbiera minimálne množstvo osobných údajov nevyhnutných pre prevádzku portálu:</p>
        <ul style={{ paddingLeft: 24, margin: "0 0 16px" }}>
          <li style={li}><strong>Email (newsletter)</strong> — iba ak sa dobrovoľne prihlásíte na odber noviniek.</li>
          <li style={li}><strong>Cookies</strong> — technické (nevyhnutné pre fungovanie) a analytické (ak súhlasíte).</li>
          <li style={li}><strong>Affiliate tracking</strong> — anonymné ID kliknutia pre sledovanie konverzií cez partnerské siete.</li>
        </ul>
        <p style={p}>Nezberáme mená, adresy ani platobné informácie.</p>

        <h2 style={h2}>2. Affiliate linky</h2>
        <p style={p}>
          Stránka obsahuje affiliate linky. To znamená, že ak nakúpite cez niektorý z odkazov na tejto stránke, môžeme získať malú
          províziu od obchodu. Pre vás je cena totožná. Tieto odmeny nám pomáhajú udržiavať portál bezplatný.
        </p>

        <h2 style={h2}>3. Cookies</h2>
        <ul style={{ paddingLeft: 24, margin: "0 0 16px" }}>
          <li style={li}><strong>Funkčné cookies</strong> — potrebné na správne fungovanie stránky (session, cache).</li>
          <li style={li}><strong>Analytické cookies</strong> — anonymná štatistika návštevnosti (napr. Google Analytics). Môžete ich zakázať v nastaveniach prehliadača.</li>
        </ul>

        <h2 style={h2}>4. Vaše GDPR práva</h2>
        <p style={p}>Podľa nariadenia GDPR máte nasledujúce práva:</p>
        <ul style={{ paddingLeft: 24, margin: "0 0 16px" }}>
          <li style={li}><strong>Právo na prístup</strong> — môžete požiadať o informácie o vašich údajoch, ktoré spracovávame.</li>
          <li style={li}><strong>Právo na vymazanie</strong> — môžete požiadať o vymazanie vašich osobných údajov (napr. emailu z newslettera).</li>
          <li style={li}><strong>Právo na prenosnosť</strong> — môžete získať vaše údaje v strojovo čitateľnom formáte.</li>
          <li style={li}><strong>Právo na námietku</strong> — môžete namietať proti spracovaniu vašich údajov na marketingové účely.</li>
        </ul>
        <p style={p}>Pre uplatnenie práv nás kontaktujte na: <a href="mailto:info@zlavickovo.sk" style={{ color: "#22C55E" }}>info@zlavickovo.sk</a></p>

        <h2 style={h2}>5. Kontakt</h2>
        <p style={p}>
          Prevádzkovateľ: Zlavickovo.sk<br />
          Email: <a href="mailto:info@zlavickovo.sk" style={{ color: "#22C55E" }}>info@zlavickovo.sk</a>
        </p>
      </div>

      <Footer />
    </div>
  );
}
