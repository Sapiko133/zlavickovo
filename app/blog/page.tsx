import { getAllPosts, categoryLabel, type BlogPost } from "@/lib/blog";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
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
  navody:     { bg: "#f0fdf4", color: "#16a34a" },
  porovnanie: { bg: "#fff7ed", color: "#ea580c" },
};

const CAT_KEYWORDS: Record<string, string> = {
  tipy:       "money,savings,finance",
  kupony:     "shopping,sale,discount",
  navody:     "laptop,online-shopping",
  porovnanie: "products,compare,choice",
};

function blogImageUrl(post: BlogPost): string {
  const kw = post.shop
    ? `${encodeURIComponent(post.shop.toLowerCase())},shopping`
    : encodeURIComponent(CAT_KEYWORDS[post.category] || "shopping,deals");
  return `https://source.unsplash.com/800x440/?${kw}`;
}

export default function BlogPage() {
  const posts = getAllPosts();
  return (
    <div style={{ minHeight: "100vh", background: "#fff", fontFamily: "'Inter', system-ui, sans-serif", color: "#1d1d1f" }}>
      <Nav />

      <div style={{ background: "#F0FDF4", borderBottom: "1px solid #BBF7D0", padding: "56px 24px 48px", textAlign: "center" }}>
        <h1 style={{ fontSize: "clamp(28px, 5vw, 48px)", fontWeight: 800, letterSpacing: "-1px", margin: "0 0 12px", color: "#1d1d1f" }}>Blog</h1>
        <p style={{ fontSize: 16, color: "#555", margin: 0 }}>Tipy, návody a porovnania pre inteligentných nakupovateľov</p>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px 80px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 24 }}>
          {posts.map(post => {
            const cat = CAT_COLORS[post.category] || { bg: "#f5f5f5", color: "#555" };
            const imgUrl = blogImageUrl(post);
            return (
              <a key={post.slug} href={`/blog/${post.slug}`} style={{ display: "flex", flexDirection: "column", textDecoration: "none", background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", boxShadow: "0 2px 12px rgba(0,0,0,0.05)", overflow: "hidden" }}>
                <div style={{ position: "relative", height: 180, overflow: "hidden", background: "#f9fafb" }}>
                  <img
                    src={imgUrl}
                    alt={post.title}
                    loading="lazy"
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                  <div style={{ position: "absolute", top: 12, left: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 100, background: cat.bg, color: cat.color }}>
                      {categoryLabel(post.category)}
                    </span>
                  </div>
                </div>
                <div style={{ padding: "20px 24px", flex: 1 }}>
                  {post.shop && <div style={{ fontSize: 11, color: "#666", marginBottom: 6 }}>{post.shop}</div>}
                  <div style={{ fontWeight: 700, fontSize: 16, color: "#1d1d1f", lineHeight: 1.4, marginBottom: 10 }}>{post.title}</div>
                  <div style={{ fontSize: 13, color: "#666", lineHeight: 1.6 }}>{post.description}</div>
                </div>
                <div style={{ padding: "12px 24px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #e5e7eb" }}>
                  <span style={{ fontSize: 12, color: "#666" }}>{new Date(post.date).toLocaleDateString("sk-SK")}</span>
                  <span style={{ fontSize: 13, color: "#22C55E", fontWeight: 600 }}>Čítať →</span>
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
