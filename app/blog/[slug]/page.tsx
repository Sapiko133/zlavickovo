import { getAllPosts, getPostBySlug, categoryLabel } from "@/lib/blog";
import Footer from "@/components/Footer";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getAllPosts().map(p => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `https://zlavickovo.sk/blog/${slug}` },
    openGraph: { title: post.title, description: post.description, type: "article", publishedTime: post.date },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const shopSlug = post.shop ? post.shop.toLowerCase().replace(/\s+/g, "-") : null;

  return (
    <div style={{ minHeight: "100vh", background: "#fff", fontFamily: "'Inter', system-ui, sans-serif", color: "#1d1d1f" }}>

      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 48px", height: 56, position: "sticky", top: 0, zIndex: 100, background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "#1d1d1f" }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #7C3AED, #2563EB)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, fontWeight: 800 }}>Z</div>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Zlavickovo</span>
        </a>
        <div style={{ display: "flex", gap: 20, fontSize: 13 }}>
          <a href="/blog" style={{ color: "#7C3AED", textDecoration: "none" }}>← Blog</a>
          <a href="/" style={{ color: "#555", textDecoration: "none" }}>Domov</a>
        </div>
      </nav>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px 80px", display: "flex", gap: 48, alignItems: "flex-start" }}>

        {/* Article */}
        <article style={{ flex: 1, minWidth: 0, maxWidth: 720 }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 100, background: "#f0eeff", color: "#7C3AED" }}>{categoryLabel(post.category)}</span>
              {post.shop && <span style={{ fontSize: 12, color: "#aaa" }}>{post.shop}</span>}
              <span style={{ fontSize: 12, color: "#bbb" }}>{new Date(post.date).toLocaleDateString("sk-SK")}</span>
            </div>
            <h1 style={{ fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 800, letterSpacing: "-0.5px", lineHeight: 1.2, margin: "0 0 16px" }}>{post.title}</h1>
            <p style={{ fontSize: 16, color: "#555", lineHeight: 1.7, margin: 0 }}>{post.description}</p>
          </div>

          <hr style={{ border: "none", borderTop: "1px solid #f0f0f0", margin: "32px 0" }} />

          <style>{`
            article h2 { font-size: 22px; font-weight: 700; margin: 36px 0 14px; letter-spacing: -0.3px; color: #1d1d1f; }
            article h3 { font-size: 17px; font-weight: 700; margin: 24px 0 10px; color: #1d1d1f; }
            article p  { font-size: 15px; line-height: 1.8; color: #444; margin: 0 0 16px; }
            article ul { padding-left: 22px; margin: 0 0 16px; }
            article li { font-size: 15px; line-height: 1.8; color: #444; margin-bottom: 6px; }
            article ol { padding-left: 22px; margin: 0 0 16px; }
            article strong { color: #1d1d1f; }
          `}</style>

          <div dangerouslySetInnerHTML={{ __html: post.content }} />

          {shopSlug && (
            <div style={{ marginTop: 48, padding: "28px 28px", background: "linear-gradient(135deg, #f5f3ff, #eff6ff)", borderRadius: 16, border: "1px solid rgba(124,58,237,0.15)", textAlign: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Nájdi zľavový kód pre {post.shop}</div>
              <div style={{ fontSize: 14, color: "#666", marginBottom: 20 }}>Aktuálne overené kupóny a promo kódy na jednom mieste.</div>
              <a href={`/kupony/${shopSlug}`} style={{ display: "inline-block", padding: "12px 24px", borderRadius: 12, background: "linear-gradient(135deg, #7C3AED, #2563EB)", color: "#fff", fontWeight: 700, fontSize: 15, textDecoration: "none" }}>
                Zobraziť kupóny pre {post.shop} →
              </a>
            </div>
          )}
        </article>

        {/* Sidebar */}
        <aside style={{ width: 280, flexShrink: 0, position: "sticky", top: 72, display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ background: "#fafafa", borderRadius: 16, padding: "20px" }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, color: "#1d1d1f" }}>Ďalšie články</div>
            {getAllPosts().filter(p => p.slug !== post.slug).slice(0, 5).map(p => (
              <a key={p.slug} href={`/blog/${p.slug}`} style={{ display: "block", padding: "10px 0", borderBottom: "1px solid #f0f0f0", textDecoration: "none" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1d1d1f", lineHeight: 1.4 }}>{p.title}</div>
                <div style={{ fontSize: 11, color: "#bbb", marginTop: 3 }}>{categoryLabel(p.category)}</div>
              </a>
            ))}
          </div>
          {shopSlug && (
            <a href={`/kupony/${shopSlug}`} style={{ display: "block", padding: "16px", background: "linear-gradient(135deg, #7C3AED, #2563EB)", borderRadius: 14, textDecoration: "none", textAlign: "center" }}>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>Kupóny pre {post.shop} →</div>
            </a>
          )}
        </aside>

      </div>

      <Footer />
    </div>
  );
}
