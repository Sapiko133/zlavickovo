import ContactForm from "@/components/ContactForm";
import Footer from "@/components/Footer";
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
    color: "#f5f3ff",
    border: "rgba(124,58,237,0.2)",
    badge: null,
    features: [
      "Featured umiestnenie v kategórii",
      "Logo a popis obchodu",
      "Mesačné reporty",
    ],
  },
  {
    name: "Pro",
    price: "99€/mes",
    color: "linear-gradient(135deg, #f5f3ff, #eff6ff)",
    border: "#7C3AED",
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
    color: "#fff8f0",
    border: "#f97316",
    badge: "Najlepší",
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

      {/* Nav */}
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 48px", height: 56, position: "sticky", top: 0, zIndex: 100,
        background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(0,0,0,0.08)",
      }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "#1d1d1f" }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #7C3AED, #2563EB)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, fontWeight: 800 }}>Z</div>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Zlavickovo</span>
        </a>
        <a href="/" style={{ fontSize: 13, color: "#555", textDecoration: "none" }}>← Domov</a>
      </nav>

      {/* Hero */}
      <div style={{ background: "linear-gradient(180deg, #f5f3ff 0%, #fff 100%)", padding: "64px 24px 56px", textAlign: "center" }}>
        <h1 style={{ fontSize: "clamp(30px, 5vw, 52px)", fontWeight: 800, letterSpacing: "-1.5px", margin: "0 0 16px" }}>
          Inzerujte na Zlavickovo
        </h1>
        <p style={{ fontSize: 17, color: "#555", maxWidth: 560, margin: "0 auto", lineHeight: 1.7 }}>
          Oslovte zákazníkov, ktorí aktívne hľadajú zľavy. Naša platforma poháňaná AI pokrýva slovenský a český trh.
        </p>
      </div>

      {/* Prečo inzerovať */}
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "56px 24px 0" }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.5px", textAlign: "center", margin: "0 0 36px" }}>
          Prečo inzerovať na Zlavickovo?
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
          {[
            { icon: "🎯", title: "Cielení návštevníci", desc: "Ľudia, ktorí hľadajú zľavy, sú pripravení nakupovať." },
            { icon: "🇸🇰", title: "SK + CZ trh",         desc: "Pokrývame slovenský aj český trh v jednej kampani." },
            { icon: "🤖", title: "AI platforma",         desc: "Moderná AI platforma s rastúcou návštevnosťou." },
            { icon: "📊", title: "Merateľné výsledky",   desc: "Transparentné reporty o kliknutiach a konverziách." },
          ].map((item, i) => (
            <div key={i} style={{ background: "#fafafa", borderRadius: 16, padding: "24px 20px", border: "1px solid #f0f0f0", textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>{item.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{item.title}</div>
              <div style={{ fontSize: 13, color: "#666", lineHeight: 1.6 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Cenník */}
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "64px 24px 0" }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.5px", textAlign: "center", margin: "0 0 36px" }}>Cenník</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
          {PLANS.map((plan) => (
            <div key={plan.name} style={{
              borderRadius: 20, padding: "32px 28px",
              background: typeof plan.color === "string" && plan.color.startsWith("linear") ? plan.color : plan.color,
              border: `2px solid ${plan.border}`,
              position: "relative",
            }}>
              {plan.badge && (
                <div style={{
                  position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
                  background: "linear-gradient(135deg, #7C3AED, #2563EB)", color: "#fff",
                  padding: "4px 14px", borderRadius: 100, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
                }}>{plan.badge}</div>
              )}
              <div style={{ fontWeight: 800, fontSize: 22, color: "#1d1d1f", marginBottom: 4 }}>{plan.name}</div>
              <div style={{ fontWeight: 800, fontSize: 28, color: "#7C3AED", marginBottom: 24 }}>{plan.price}</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {plan.features.map((f, i) => (
                  <li key={i} style={{ fontSize: 14, color: "#444", display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <span style={{ color: "#7C3AED", fontWeight: 700, flexShrink: 0 }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p style={{ textAlign: "center", fontSize: 13, color: "#aaa", marginTop: 20 }}>
          Všetky ceny sú bez DPH. Možná aj jednorázová spolupráca — kontaktujte nás.
        </p>
      </div>

      {/* Kontaktný formulár */}
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "64px 24px 80px" }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.5px", textAlign: "center", margin: "0 0 8px" }}>
          Mám záujem o inzerciu
        </h2>
        <p style={{ textAlign: "center", fontSize: 14, color: "#888", margin: "0 0 36px" }}>
          Vyplňte formulár a ozveme sa vám do 24 hodín.
        </p>
        <ContactForm />
      </div>

      <Footer />
    </div>
  );
}
