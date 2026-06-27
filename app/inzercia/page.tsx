import ContactForm from "@/components/ContactForm";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Inzercia | Zlavickovo.sk",
  description: "Inzerujte na Zlavickovo.sk a oslovte zákazníkov hľadajúcich zľavy. SK+CZ trh, AI platforma, 3 balíky od 49€/mes.",
  alternates: { canonical: "https://zlavickovo.sk/inzercia" },
};

const PLANS = [
  {
    name: "Starter",
    price: "49€/mes",
    highlight: false,
    features: [
      "Featured umiestnenie v kategórii",
      "Logo a popis obchodu",
      "Mesačné reporty",
    ],
  },
  {
    name: "Pro",
    price: "99€/mes",
    highlight: true,
    badge: "Populárny",
    features: [
      "Featured na hlavnej stránke",
      "Featured v kategórii",
      "Logo a popis obchodu",
      "Prioritná podpora",
      "Týždenné reporty",
    ],
  },
  {
    name: "Premium",
    price: "199€/mes",
    highlight: false,
    features: [
      "Všetko z Pro balíka",
      "Zaradenie do newslettera",
      "Sponsored kupón (1x/mes)",
      "Dedikovaný account manager",
      "Denné reporty",
    ],
  },
];

export default function InzerciaPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#fff", fontFamily: "'Inter', system-ui, sans-serif", color: "#1d1d1f" }}>

      <Nav />

      {/* Hero */}
      <div style={{ background: "#F0FDF4", borderBottom: "1px solid #BBF7D0", padding: "64px 24px 56px", textAlign: "center" }}>
        <h1 style={{ fontSize: "clamp(30px, 5vw, 52px)", fontWeight: 800, letterSpacing: "-1.5px", margin: "0 0 16px", color: "#1d1d1f" }}>
          Inzerujte na Zlavickovo
        </h1>
        <p style={{ fontSize: 17, color: "#555", maxWidth: 560, margin: "0 auto", lineHeight: 1.7 }}>
          Oslovte zákazníkov, ktorí aktívne hľadajú zľavy. Naša platforma poháňaná AI pokrýva slovenský a český trh.
        </p>
      </div>

      {/* Prečo inzerovať */}
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "56px 24px 0" }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.5px", textAlign: "center", margin: "0 0 36px", color: "#1d1d1f" }}>
          Prečo inzerovať na Zlavickovo?
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
          {[
            { icon: "🎯", title: "Cielení návštevníci", desc: "Ľudia, ktorí hľadajú zľavy, sú pripravení nakupovať." },
            { icon: "🇸🇰", title: "SK + CZ trh",         desc: "Pokrývame slovenský aj český trh v jednej kampani." },
            { icon: "🤖", title: "AI platforma",         desc: "Moderná AI platforma s rastúcou návštevnosťou." },
            { icon: "📊", title: "Merateľné výsledky",   desc: "Transparentné reporty o kliknutiach a konverziách." },
          ].map((item, i) => (
            <div key={i} style={{ background: "#f9fafb", borderRadius: 16, padding: "24px 20px", border: "1px solid #e5e7eb", textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>{item.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6, color: "#1d1d1f" }}>{item.title}</div>
              <div style={{ fontSize: 13, color: "#666", lineHeight: 1.6 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Cenník */}
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "64px 24px 0" }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.5px", textAlign: "center", margin: "0 0 36px", color: "#1d1d1f" }}>Cenník</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
          {PLANS.map((plan) => (
            <div key={plan.name} style={{
              borderRadius: 20, padding: "32px 28px",
              background: plan.highlight ? "#F0FDF4" : "#f9fafb",
              border: `2px solid ${plan.highlight ? "#22C55E" : "#e5e7eb"}`,
              position: "relative",
            }}>
              {plan.badge && (
                <div style={{
                  position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
                  background: "#22C55E", color: "#fff",
                  padding: "4px 14px", borderRadius: 100, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
                }}>{plan.badge}</div>
              )}
              <div style={{ fontWeight: 800, fontSize: 22, color: "#1d1d1f", marginBottom: 4 }}>{plan.name}</div>
              <div style={{ fontWeight: 800, fontSize: 28, color: "#22C55E", marginBottom: 24 }}>{plan.price}</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {plan.features.map((f, i) => (
                  <li key={i} style={{ fontSize: 14, color: "#444", display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <span style={{ color: "#22C55E", fontWeight: 700, flexShrink: 0 }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p style={{ textAlign: "center", fontSize: 13, color: "#666", marginTop: 20 }}>
          Všetky ceny sú bez DPH. Možná aj jednorázová spolupráca — kontaktujte nás.
        </p>
      </div>

      {/* Kontaktný formulár */}
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "64px 24px 80px" }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.5px", textAlign: "center", margin: "0 0 8px", color: "#1d1d1f" }}>
          Mám záujem o inzerciu
        </h2>
        <p style={{ textAlign: "center", fontSize: 14, color: "#666", margin: "0 0 36px" }}>
          Vyplňte formulár a ozveme sa vám do 24 hodín.
        </p>
        <ContactForm />
      </div>

      <Footer />
    </div>
  );
}
