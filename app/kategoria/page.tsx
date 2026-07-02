import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { CATEGORIES_LIST } from "@/lib/categories";

export const metadata = {
  title: "Kategórie kupónov | Zlavickovo",
  description: "Prehľad všetkých kategórií zľavových kódov a kupónov pre slovenské obchody.",
  alternates: { canonical: "https://www.zlavickovo.sk/kategoria" },
};

export default function KategoriaPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#fff", fontFamily: "system-ui,-apple-system,sans-serif" }}>
      <Nav />

      <style>{`
        .kat-card {
          transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s ease;
        }
        .kat-card:hover {
          transform: translateY(-6px) scale(1.02);
          box-shadow: 0 16px 40px rgba(0,0,0,0.12) !important;
        }
      `}</style>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px 80px" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#1d1d1f", margin: "0 0 8px" }}>
          Všetky kategórie
        </h1>
        <p style={{ fontSize: 15, color: "#666", margin: "0 0 36px", lineHeight: 1.6 }}>
          Vyberte kategóriu a nájdite tie najlepšie kupóny a zľavové kódy.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 16 }}>
          {CATEGORIES_LIST.map((cat) => (
            <a
              key={cat.slug}
              href={`/kategoria/${cat.slug}`}
              className="kat-card"
              style={{
                display: "flex", flexDirection: "column", padding: "24px 20px",
                borderRadius: 16, textDecoration: "none",
                background: cat.bg,
                border: `1.5px solid ${cat.color}30`,
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              }}
            >
              <span style={{ fontSize: 40, lineHeight: 1, marginBottom: 12 }}>{cat.emoji}</span>
              <span style={{ fontSize: 17, fontWeight: 700, color: cat.color, marginBottom: 6 }}>
                {cat.label}
              </span>
              <p style={{ fontSize: 12, color: "#555", margin: "0 0 14px", lineHeight: 1.5, flex: 1 }}>
                {cat.desc}
              </p>
              <div style={{ fontSize: 12, color: cat.color, fontWeight: 700 }}>
                {cat.shops.length} obchod{cat.shops.length < 2 ? "" : cat.shops.length < 5 ? "y" : "ov"}
              </div>
            </a>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
