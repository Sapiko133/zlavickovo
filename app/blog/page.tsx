import { getAllPosts, categoryLabel } from "@/lib/blog";
import Footer from "@/components/Footer";
import type { Metadata } from "next";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Blog - tipy a návody na šetrenie | Zlavickovo.sk",
  description: "Články o zľavových kódoch, cashbacku a tipy ako nakupovať lacnejšie. Aktuálne návody pre slovenských zákazníkov.",
  alternates: { canonical: "https://zlavickovo.sk/blog" },
};

const CAT_COLORS: Record<string, { bg: string; color: string }> = {
  tipy:       { bg: "#eff6ff", color: "#1d4ed8" },
  kupony:     { bg: "#f0fdf4", color: "#16a34a" },
  navody:     { bg: "#fdf4ff", color: "#9333ea" },
  porovnanie: { bg: "#fff7ed", color: "#ea580c" },
};

export default function BlogPage() {
  const posts = getAllPosts();
  return (
    <div style={{ minHeight: "100vh", background: "#fff", fontFamily: "'Inter', system-ui, sans-serif", color: "#1d1d1f" }}>

      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 48px", height: 56, position: "sticky", top: 0, zIndex: 100, background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "#1d1d1f" }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #7C3AED, #2563EB)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, fontWeight: 800 }}>Z</div>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Zlavickovo</span>
        </a>
        <div style={{ display: "flex", gap: 20, fontSize: 13 }}>
          <a href="/obchody" style={{ color: "#555", textDecoration: "none" }}>Obchody</a>
          <a href="/cashback" style={{ color: "#555", textDecoration: "none" }}>Cashback</a>
          <a href="/blog" style={{ color: "#7C3AED", fontWeight: 600, textDecoration: "none" }}>Blog</a>
          <a href="/" style={{ color: "#555", textDecoration: "none" }}>← Domov</a>
        </div>
      </nav>

      <div style={{ background: "linear-gradient(180deg, #f5f3ff 0%, #fff 100%)", padding: "56px 24px 48px", textAlign: "center" }}>
        <h1 style={{ fontSize: "clamp(28px, 5vw, 48px)", fontWeight: 800, letterSpacing: "-1px", margin: "0 0 12px" }}>Blog</h1>
        <p style={{ fontSize: 16, color: "#666", margin: 0 }}>Tipy, návody a porovnania pre inteligentných nakupovateľov</p>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px 80px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 24 }}>
          {posts.map(post => {
            const cat = CAT_COLORS[post.category] || { bg: "#f5f5f5", color: "#555" };
            return (
              <a key={post.slug} href={`/blog/${post.slug}`} style={{ display: "flex", flexDirection: "column", textDecoration: "none", background: "#fff", borderRadius: 16, border: "1px solid #eee", boxShadow: "0 2px 12px rgba(0,0,0,0.05)", overflow: "hidden", transition: "transform 0.15s" }}>
                <div style={{ padding: "24px 24px 20px", flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 100, background: cat.bg, color: cat.color }}>{categoryLabel(post.category)}</span>
                    {post.shop && <span style={{ fontSize: 11, color: "#aaa" }}>{post.shop}</span>}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: "#1d1d1f", lineHeight: 1.4, marginBottom: 10 }}>{post.title}</div>
                  <div style={{ fontSize: 13, color: "#666", lineHeight: 1.6 }}>{post.description}</div>
                </div>
                <div style={{ padding: "12px 24px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "#bbb" }}>{new Date(post.date).toLocaleDateString("sk-SK")}</span>
                  <span style={{ fontSize: 13, color: "#7C3AED", fontWeight: 600 }}>Čítať →</span>
                </div>
              </a>
            );
          })}
        </div>
      </div>

      <Footer />
    </div>
  );
}
