import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import ShopFavicon from "@/components/ShopFavicon";
import { STATIC_AKCIE, dognetCouponToAkcia, type Akcia, type AkciaType } from "@/lib/akcie";
import { getSalesCoupons } from "@/lib/dognet";
import type { Metadata } from "next";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Akcie a výhodné ponuky 2026 | Zlavickovo.sk",
  description: "Aktuálne akcie, výpredaje a doprava zadarmo od stoviek obchodov. Doprava zadarmo Alza, Zalando, Notino a ďalšie.",
  alternates: { canonical: "https://zlavickovo.sk/akcie" },
  openGraph: {
    title: "Akcie a výhodné ponuky | Zlavickovo",
    description: "Doprava zadarmo, výpredaje a špeciálne ponuky z oblíbených obchodov.",
    url: "https://zlavickovo.sk/akcie", type: "website", locale: "sk_SK",
  },
};

const TYPE_CONFIG: Record<AkciaType, { label: string; color: string; bg: string; emoji: string }> = {
  doprava:  { label: "Doprava zadarmo", color: "#0065BD", bg: "#dbeafe", emoji: "🚚" },
  vypredaj: { label: "Výpredaj",        color: "#E8001D", bg: "#fee2e2", emoji: "🏷️" },
  welcome:  { label: "Pre nových",      color: "#7C3AED", bg: "#ede9fe", emoji: "🎁" },
  cashback: { label: "Cashback",        color: "#16a34a", bg: "#dcfce7", emoji: "💰" },
  gift:     { label: "Darček",          color: "#db2777", bg: "#fdf2f8", emoji: "🎀" },
  event:    { label: "Týždenná akcia",  color: "#FF6900", bg: "#fed7aa", emoji: "📅" },
};

const FILTER_TABS: { key: AkciaType | "all"; label: string }[] = [
  { key: "all",     label: "Všetky" },
  { key: "doprava", label: "🚚 Doprava zadarmo" },
  { key: "vypredaj",label: "🏷️ Výpredaje" },
  { key: "welcome", label: "🎁 Pre nových" },
  { key: "gift",    label: "🎀 Darčeky" },
  { key: "event",   label: "📅 Akcie" },
];

function AkciaCard({ akcia }: { akcia: Akcia }) {
  const cfg = TYPE_CONFIG[akcia.type];
  return (
    <a
      href={akcia.affiliateUrl}
      target="_blank"
      rel="nofollow noopener noreferrer"
      className="akcia-card"
      style={{
        display: "flex", flexDirection: "column",
        background: "#fff", borderRadius: 14, border: "1.5px solid #e8e8e8",
        padding: "18px 16px", textDecoration: "none", color: "#1d1d1f",
        gap: 10,
      }}
    >
      {/* Top row: logo + shop name + badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <ShopFavicon domain={akcia.domain || ""} name={akcia.shopName} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1d1d1f", lineHeight: 1.2 }}>
            {akcia.shopName}
          </div>
          <span style={{
            display: "inline-block", marginTop: 3,
            fontSize: 10, fontWeight: 800, letterSpacing: "0.04em",
            color: cfg.color, background: cfg.bg,
            padding: "2px 7px", borderRadius: 100,
          }}>
            {cfg.emoji} {akcia.badge ?? cfg.label}
          </span>
        </div>
      </div>

      {/* Title */}
      <div style={{ fontSize: 14, fontWeight: 700, color: "#1d1d1f", lineHeight: 1.35 }}>
        {akcia.title}
      </div>

      {/* Description */}
      {akcia.description && (
        <div style={{ fontSize: 12, color: "#666", lineHeight: 1.5 }}>
          {akcia.description}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto", paddingTop: 8 }}>
        <span style={{ fontSize: 11, color: "#aaa" }}>
          {akcia.validTo ? `Platí do ${new Date(akcia.validTo).toLocaleDateString("sk-SK")}` : "Priebežná akcia"}
        </span>
        <span style={{
          fontSize: 12, fontWeight: 700, color: "#fff",
          background: "#22C55E", borderRadius: 8, padding: "5px 12px",
        }}>
          Využiť →
        </span>
      </div>
    </a>
  );
}

export default async function AkciePage() {
  // Pull live sales from Dognet (type 1 + 3)
  let dognetAkcie: Akcia[] = [];
  try {
    const sales = await getSalesCoupons(20);
    dognetAkcie = sales
      .filter((c: any) => c.campaign?.name)
      .map(dognetCouponToAkcia);
  } catch {}

  const allAkcie: Akcia[] = [...dognetAkcie, ...STATIC_AKCIE];

  // Dedup by id
  const seen = new Set<string>();
  const deduped = allAkcie.filter(a => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });

  const byType = (type: AkciaType) => deduped.filter(a => a.type === type);
  const doprava = byType("doprava");
  const vypredaje = byType("vypredaj");
  const ostatne = deduped.filter(a => a.type !== "doprava" && a.type !== "vypredaj");

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "system-ui, -apple-system, sans-serif", color: "#1d1d1f" }}>
      <style>{`.akcia-card{box-shadow:0 2px 8px rgba(0,0,0,0.04);transition:transform .15s,box-shadow .15s}.akcia-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,0.10)}`}</style>
      <Nav />

      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #f0f0f0", padding: "40px 24px 32px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ fontSize: 12, color: "#999", marginBottom: 10 }}>
            <a href="/" style={{ color: "#999", textDecoration: "none" }}>Zlavickovo</a>
            {" › "}
            <span style={{ color: "#22C55E", fontWeight: 600 }}>Akcie</span>
          </div>
          <h1 style={{ fontSize: "clamp(22px,4vw,34px)", fontWeight: 800, margin: "0 0 8px", letterSpacing: "-0.5px" }}>
            🏷️ Akcie a výhodné ponuky
          </h1>
          <p style={{ fontSize: 15, color: "#666", margin: 0 }}>
            Doprava zadarmo, výpredaje a špeciálne ponuky z oblíbených obchodov. Aktualizované denne.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px 64px" }}>

        {/* Doprava zadarmo */}
        {doprava.length > 0 && (
          <section style={{ marginBottom: 48 }}>
            <h2 style={{ fontSize: 19, fontWeight: 800, margin: "0 0 18px", display: "flex", alignItems: "center", gap: 8 }}>
              🚚 Doprava zadarmo
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
              {doprava.map(a => <AkciaCard key={a.id} akcia={a} />)}
            </div>
          </section>
        )}

        {/* Výpredaje */}
        {vypredaje.length > 0 && (
          <section style={{ marginBottom: 48 }}>
            <h2 style={{ fontSize: 19, fontWeight: 800, margin: "0 0 18px", display: "flex", alignItems: "center", gap: 8 }}>
              🏷️ Výpredaje
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
              {vypredaje.map(a => <AkciaCard key={a.id} akcia={a} />)}
            </div>
          </section>
        )}

        {/* Ostatné (welcome, gift, event, cashback) */}
        {ostatne.length > 0 && (
          <section style={{ marginBottom: 48 }}>
            <h2 style={{ fontSize: 19, fontWeight: 800, margin: "0 0 18px", display: "flex", alignItems: "center", gap: 8 }}>
              ✨ Špeciálne ponuky
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
              {ostatne.map(a => <AkciaCard key={a.id} akcia={a} />)}
            </div>
          </section>
        )}

        {deduped.length === 0 && (
          <div style={{ textAlign: "center", padding: "80px 20px", color: "#aaa" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
            <p>Momentálne žiadne akcie. Skontroluj neskôr.</p>
          </div>
        )}

        {/* Info note */}
        <div style={{ marginTop: 16, padding: "14px 18px", borderRadius: 10, background: "#f0fdf4", border: "1px solid #bbf7d0", fontSize: 12, color: "#166534" }}>
          ℹ️ Podmienky akcií (napr. minimálna suma pre dopravu zadarmo) sa môžu zmeniť. Vždy si overte aktuálne podmienky priamo v obchode pred nákupom.
        </div>
      </div>

      <Footer />
    </div>
  );
}
