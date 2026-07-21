import { getPublishedArticles } from "@/lib/articles";
import ArticleCard from "@/components/ArticleCard";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import type { Metadata } from "next";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Blog – akcie, výpredaje a tipy na šetrenie | Zlavickovo.sk",
  description: "Aktuálne výpredaje obchodov, zľavnené produkty a tipy ako nakupovať lacnejšie. Nové články pravidelne.",
  alternates: { canonical: "https://www.zlavickovo.sk/blog" },
};

export default async function BlogPage() {
  const articles = await getPublishedArticles();

  return (
    <div style={{ minHeight: "100vh", background: "#fff", fontFamily: "system-ui, sans-serif", color: "#1d1d1f" }}>
      <style>{`.article-card:hover{transform:translateY(-3px);box-shadow:0 10px 28px rgba(0,0,0,0.10)!important;border-color:#22C55E!important}`}</style>
      <Nav />

      <div style={{ background: "#F0FDF4", borderBottom: "1px solid #BBF7D0", padding: "48px 24px 40px", textAlign: "center" }}>
        <h1 style={{ fontSize: "clamp(28px, 5vw, 44px)", fontWeight: 800, letterSpacing: "-1px", margin: "0 0 12px" }}>Blog</h1>
        <p style={{ fontSize: 16, color: "#555", margin: 0 }}>Výpredaje, zľavnené produkty a tipy pre výhodnejší nákup</p>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 24px 80px" }}>
        {articles.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 22 }}>
            {articles.map((a) => <ArticleCard key={a.slug} article={a} />)}
          </div>
        ) : (
          <div style={{ padding: "60px 20px", textAlign: "center", color: "#9ca3af", background: "#f8f9fa", borderRadius: 16, border: "1px solid #eceff3" }}>
            Články pripravujeme.
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
