import { getAllPosts, getPostBySlug, categoryLabel } from "@/lib/blog";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

type Props = { params: Promise<{ slug: string }> };

const CAT_KEYWORDS: Record<string, string> = {
  tipy:       "money,savings,finance",
  kupony:     "shopping,sale,discount",
  navody:     "laptop,online-shopping",
  porovnanie: "products,compare,choice",
};

function blogImageUrl(category: string, shop?: string): string {
  const kw = shop
    ? `${encodeURIComponent(shop.toLowerCase())},shopping`
    : encodeURIComponent(CAT_KEYWORDS[category] || "shopping,deals");
  return `https://source.unsplash.com/1200x500/?${kw}`;
}

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
  const imgUrl = blogImageUrl(post.category, post.shop);

  return (
    <div style={{ minHeight: "100vh", background: "#fff", fontFamily: "'Inter', system-ui, sans-serif", color: "#1d1d1f" }}>
      <Nav />

      {/* Hero obrázok článku */}
      <div style={{ position: "relative", height: "clamp(200px, 30vw, 420px)", overflow: "hidden", background: "#f9fafb" }}>
        <img src={imgUrl} alt={post.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.6) 100%)" }} />
        <div style={{ position: "absolute", bottom: 24, left: 24, right: 24 }}>
          <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 100, background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)" }}>
            {categoryLabel(post.category)}
          </span>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px 80px", display: "flex", gap: 48, alignItems: "flex-start" }}>

        {/* Article */}
        <article style={{ flex: 1, minWidth: 0, maxWidth: 720 }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
              {post.shop && <span style={{ fontSize: 12, color: "#666" }}>{post.shop}</span>}
              <span style={{ fontSize: 12, color: "#666" }}>{new Date(post.date).toLocaleDateString("sk-SK")}</span>
            </div>
            <h1 style={{ fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 800, letterSpacing: "-0.5px", lineHeight: 1.2, margin: "0 0 16px", color: "#1d1d1f" }}>{post.title}</h1>
            <p style={{ fontSize: 16, color: "#666", lineHeight: 1.7, margin: 0 }}>{post.description}</p>
          </div>

          <hr style={{ border: "none", borderTop: "1px solid #e5e7eb", margin: "32px 0" }} />

          <style>{`
            article h2 { font-size: 22px; font-weight: 700; margin: 36px 0 14px; letter-spacing: -0.3px; color: #1d1d1f; }
            article h3 { font-size: 17px; font-weight: 700; margin: 24px 0 10px; color: #1d1d1f; }
            article p  { font-size: 15px; line-height: 1.8; color: #444; margin: 0 0 16px; }
            article ul { padding-left: 22px; margin: 0 0 16px; }
            article li { font-size: 15px; line-height: 1.8; color: #444; margin-bottom: 6px; }
            article ol { padding-left: 22px; margin: 0 0 16px; }
            article strong { color: #1d1d1f; }
            article a { color: #22C55E; }
          `}</style>

          <div dangerouslySetInnerHTML={{ __html: post.content }} />

          {shopSlug && (
            <div style={{ marginTop: 48, padding: "28px", background: "#F0FDF4", borderRadius: 16, border: "1px solid #BBF7D0", textAlign: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8, color: "#1d1d1f" }}>Nájdi zľavový kód pre {post.shop}</div>
              <div style={{ fontSize: 14, color: "#666", marginBottom: 20 }}>Aktuálne overené kupóny a promo kódy na jednom mieste.</div>
              <a href={`/kupony/${shopSlug}`} style={{ display: "inline-block", padding: "12px 24px", borderRadius: 12, background: "#22C55E", color: "#fff", fontWeight: 700, fontSize: 15, textDecoration: "none" }}>
                Zobraziť kupóny pre {post.shop} →
              </a>
            </div>
          )}
        </article>

        {/* Sidebar */}
        <aside style={{ width: 280, flexShrink: 0, position: "sticky", top: 72, display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ background: "#f9fafb", borderRadius: 16, padding: "20px", border: "1px solid #e5e7eb" }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, color: "#1d1d1f" }}>Ďalšie články</div>
            {getAllPosts().filter(p => p.slug !== post.slug).slice(0, 5).map(p => (
              <a key={p.slug} href={`/blog/${p.slug}`} style={{ display: "block", padding: "10px 0", borderBottom: "1px solid #e5e7eb", textDecoration: "none" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1d1d1f", lineHeight: 1.4 }}>{p.title}</div>
                <div style={{ fontSize: 11, color: "#666", marginTop: 3 }}>{categoryLabel(p.category)}</div>
              </a>
            ))}
          </div>
          {shopSlug && (
            <a href={`/kupony/${shopSlug}`} style={{ display: "block", padding: "16px", background: "#22C55E", borderRadius: 14, textDecoration: "none", textAlign: "center" }}>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>Kupóny pre {post.shop} →</div>
            </a>
          )}
        </aside>

      </div>

      <Footer />
    </div>
  );
}
