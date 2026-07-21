import { getPublishedArticles } from "@/lib/articles";
import ArticleCard from "@/components/ArticleCard";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import type { Metadata } from "next";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Akcie a výpredaje obchodov 2026 | Zlavickovo.sk",
  description: "Aktuálne výpredaje a akcie slovenských a českých obchodov – zľavnené produkty, kupóny a odkazy priamo na ponuky.",
  alternates: { canonical: "https://www.zlavickovo.sk/akcie" },
  openGraph: {
    title: "Akcie a výpredaje obchodov | Zlavickovo",
    description: "Aktuálne výpredaje obchodov so zľavnenými produktmi a kupónmi.",
    url: "https://www.zlavickovo.sk/akcie", type: "website", locale: "sk_SK",
  },
};

export default async function AkciePage() {
  const articles = await getPublishedArticles("sale");

  return (
    <div style={{ minHeight: "100vh", background: "#fff", fontFamily: "system-ui, sans-serif", color: "#1d1d1f" }}>
      <style>{`.article-card:hover{transform:translateY(-3px);box-shadow:0 10px 28px rgba(0,0,0,0.10)!important;border-color:#22C55E!important}`}</style>
      <Nav />

      <div style={{ background: "#fff", borderBottom: "1px solid #f0f0f0", padding: "40px 24px 30px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ fontSize: 12, color: "#999", marginBottom: 10 }}>
            <a href="/" style={{ color: "#999", textDecoration: "none" }}>Zlavickovo</a>{" › "}
            <span style={{ color: "#22C55E", fontWeight: 600 }}>Akcie</span>
          </div>
          <h1 style={{ fontSize: "clamp(22px,4vw,34px)", fontWeight: 800, margin: "0 0 8px", letterSpacing: "-0.5px" }}>
            🏷️ Akcie a výpredaje
          </h1>
          <p style={{ fontSize: 15, color: "#666", margin: 0 }}>
            Aktuálne výpredaje obchodov so zľavnenými produktmi. Aktualizované automaticky každých 6 hodín.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "36px 24px 72px" }}>
        {articles.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 22 }}>
            {articles.map((a) => <ArticleCard key={a.slug} article={a} />)}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "80px 20px", color: "#aaa" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
            <p>Momentálne pripravujeme nové akcie. Skontroluj neskôr.</p>
          </div>
        )}

        <div style={{ marginTop: 28, padding: "14px 18px", borderRadius: 10, background: "#f0fdf4", border: "1px solid #bbf7d0", fontSize: 12, color: "#166534" }}>
          ℹ️ Ceny a dostupnosť produktov sa môžu meniť. Vždy si over aktuálne podmienky priamo v obchode pred nákupom.
        </div>
      </div>

      <Footer />
    </div>
  );
}
