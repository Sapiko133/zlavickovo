import { getCashbackShops } from "@/lib/dognet";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import type { Metadata } from "next";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Cashback - získaj peniaze späť za nákup | Zlavickovo.sk",
  description: "Nakupuj cez naše cashback linky a získaj späť časť peňazí. Funguje na Alza, Notino, Zalando a ďalších obchodoch.",
  alternates: { canonical: "https://zlavickovo.sk/cashback" },
};

const FALLBACK = [
  { id: 1, name: "Alza",        cashback: "až 3%",  slug: "alza",    affiliate_link: "/kupony/alza" },
  { id: 2, name: "Notino",      cashback: "až 8%",  slug: "notino",  affiliate_link: "/kupony/notino" },
  { id: 3, name: "Zalando",     cashback: "až 5%",  slug: "zalando", affiliate_link: "/kupony/zalando" },
  { id: 4, name: "GymBeam",     cashback: "až 10%", slug: "gymbeam", affiliate_link: "/kupony/gymbeam" },
  { id: 5, name: "Booking.com", cashback: "až 5%",  slug: "booking", affiliate_link: "#" },
];

const COLORS = ["#E8001D", "#0065BD", "#00A551", "#FF6900", "#7B2FBE", "#003580", "#D32F2F", "#FF4081", "#006A35", "#8B1A1A"];
function shopColor(name: string) {
  return COLORS[name.charCodeAt(0) % COLORS.length];
}

const STEPS = [
  { icon: "🛒", title: "Nakúpiš cez náš link", desc: "Klikneš na tlačidlo 'Nakúpiť s cashbackom' a prejdeš do obchodu." },
  { icon: "💰", title: "Obchod nám zaplatí províziu", desc: "Obchod nám uhradí affiliate odmenu za to, že si prišiel od nás." },
  { icon: "🎉", title: "Časť vrátime tebe", desc: "Zo získanej provízie vrátime časť priamo na tvoj účet." },
];

export default async function CashbackPage() {
  let shops: any[] = [];
  try { shops = await getCashbackShops(); } catch {}
  if (!shops.length) shops = FALLBACK;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "'Inter', system-ui, sans-serif", color: "var(--text)" }}>
      <Nav />

      {/* Hero – always light background, hardcode text dark */}
      <div style={{ background: "linear-gradient(180deg, #f5f3ff 0%, #eff6ff 60%, var(--bg) 100%)", padding: "64px 24px 56px", textAlign: "center" }}>
        <div style={{ display: "inline-block", padding: "6px 16px", borderRadius: 100, background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)", fontSize: 12, color: "#7C3AED", marginBottom: 20, fontWeight: 600 }}>
          💸 Cashback program
        </div>
        <h1 style={{ fontSize: "clamp(32px, 5vw, 56px)", fontWeight: 800, letterSpacing: "-1.5px", margin: "0 0 16px", color: "#1d1d1f" }}>
          Ušetri na každom nákupe
        </h1>
        <p style={{ fontSize: 17, color: "#555", maxWidth: 480, margin: "0 auto", lineHeight: 1.6 }}>
          Cashback funguje jednoducho — nakupuj v svojich obľúbených obchodoch a získavaj späť časť ceny nákupu.
        </p>
      </div>

      {/* 3 kroky */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "64px 24px 0" }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.5px", textAlign: "center", margin: "0 0 48px", color: "var(--text)" }}>
          Ako cashback funguje?
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 24 }}>
          {STEPS.map((step, i) => (
            <div key={i} style={{
              background: "var(--step-bg)", borderRadius: 20, padding: "32px 28px", textAlign: "center",
              border: "1px solid var(--step-border)", position: "relative",
            }}>
              <div style={{ fontSize: 44, marginBottom: 16 }}>{step.icon}</div>
              <div style={{
                position: "absolute", top: 16, right: 18,
                width: 28, height: 28, borderRadius: "50%",
                background: "linear-gradient(135deg, #7C3AED, #2563EB)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontWeight: 800, fontSize: 13,
              }}>{i + 1}</div>
              <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)", marginBottom: 10 }}>{step.title}</div>
              <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.6 }}>{step.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Cashback obchody */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "64px 24px" }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.5px", margin: "0 0 32px", color: "var(--text)" }}>
          Obchody s cashbackom ({shops.length})
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {shops.map((shop: any) => {
            const color = shopColor(shop.name);
            return (
              <div key={shop.id} style={{
                background: "var(--card)", borderRadius: 16, border: "1px solid var(--border)",
                boxShadow: "0 2px 12px rgba(0,0,0,0.05)", overflow: "hidden",
                display: "flex", flexDirection: "column",
              }}>
                <div style={{ padding: "20px 20px 16px", display: "flex", alignItems: "center", gap: 14, borderBottom: "1px solid var(--border)" }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: color, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 20 }}>
                    {shop.name.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>{shop.name}</div>
                    {shop.cashback && (
                      <div style={{ fontSize: 13, color: "#16a34a", fontWeight: 600, marginTop: 2 }}>
                        Cashback {shop.cashback}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ padding: "14px 20px" }}>
                  <a href={shop.affiliate_link} target="_blank" rel="nofollow noopener noreferrer"
                    style={{
                      display: "block", padding: "11px 14px", borderRadius: 10, textAlign: "center",
                      background: "linear-gradient(135deg, #7C3AED, #2563EB)", color: "#fff",
                      fontWeight: 700, fontSize: 14, textDecoration: "none",
                    }}>
                    Nakúpiť s cashbackom →
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Footer />
    </div>
  );
}
