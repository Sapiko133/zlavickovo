import ShopFavicon from "@/components/ShopFavicon";
import type { Article } from "@/lib/articles";

const GREEN = "#22C55E";
const ORANGE_DARK = "#EA580C";

/**
 * Karta článku pre gridy (homepage, /blog, /akcie).
 * Server-safe (plain <a>). Sale články majú obrázok produktu + zľavový badge,
 * tip články majú jednoduchý textový layout.
 */
export default function ArticleCard({ article }: { article: Article }) {
  const isSale = article.type === "sale";
  const date = new Date(article.date).toLocaleDateString("sk-SK");

  return (
    <a
      href={`/blog/${article.slug}`}
      className="article-card"
      style={{
        display: "flex", flexDirection: "column", textDecoration: "none", color: "#1d1d1f",
        background: "#fff", borderRadius: 16, border: "1.5px solid #eceff3", overflow: "hidden",
        boxShadow: "0 2px 8px rgba(0,0,0,0.05)", transition: "transform .18s, box-shadow .18s, border-color .15s",
      }}
    >
      {/* Obrázok */}
      <div style={{ position: "relative", height: 170, background: "#f8f9fa", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {article.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={article.imageUrl} alt={article.title} loading="lazy" style={{ width: "100%", height: "100%", objectFit: isSale ? "contain" : "cover", padding: isSale ? 12 : 0 }} />
        ) : (
          <ShopFavicon domain={article.domain || ""} name={article.shopName || article.title} size={54} />
        )}
        <span style={{
          position: "absolute", top: 12, left: 12,
          fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 100,
          color: "#fff", background: isSale ? ORANGE_DARK : GREEN,
        }}>
          {isSale ? (article.discountPct ? `AŽ -${article.discountPct}%` : "🏷️ Výpredaj") : "💡 Tip"}
        </span>
      </div>

      {/* Info */}
      <div style={{ padding: "16px 18px", flex: 1, display: "flex", flexDirection: "column" }}>
        {article.shopName && (
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
            <ShopFavicon domain={article.domain || ""} name={article.shopName} size={18} />
            <span style={{ fontSize: 12, color: "#666", fontWeight: 600 }}>{article.shopName}</span>
          </div>
        )}
        <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.4, marginBottom: 8 }}>{article.title}</div>
        <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}>
          {article.perex}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: "10px 18px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #f5f5f5" }}>
        <span style={{ fontSize: 12, color: "#9ca3af" }}>{date}</span>
        <span style={{ fontSize: 13, color: ORANGE_DARK, fontWeight: 700 }}>Čítať →</span>
      </div>
    </a>
  );
}
