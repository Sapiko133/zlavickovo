import ShopFavicon from "@/components/ShopFavicon";
import type { Article } from "@/lib/articles";
import { ARTICLE_ACCENTS } from "@/lib/static-articles";

const GREEN = "#22C55E";
const ORANGE_DARK = "#EA580C";

/**
 * Karta článku pre gridy (homepage, /blog, /akcie).
 * - `featured` = veľká horizontálna karta (hero na homepage).
 * - Ak článok nemá obrázok, vykreslí sa značkový banner (gradient + logo + zľava),
 *   takže karta nikdy nevyzerá prázdna.
 */
export default function ArticleCard({ article, featured = false }: { article: Article; featured?: boolean }) {
  const isSale = article.type === "sale";
  const date = new Date(article.date).toLocaleDateString("sk-SK");
  const accent = ARTICLE_ACCENTS[article.slug] || (isSale ? "#0F172A" : "#0f766e");

  const media = (height: number, faviconSize: number) =>
    article.imageUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={article.imageUrl} alt={article.title} loading="lazy"
        style={{ width: "100%", height: "100%", objectFit: isSale ? "contain" : "cover", padding: isSale ? 12 : 0 }} />
    ) : (
      <div style={{ width: "100%", height: "100%", background: `linear-gradient(135deg, ${accent} 0%, #0F172A 130%)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 16 }}>
        <div style={{ background: "#fff", borderRadius: 14, padding: 8, boxShadow: "0 6px 20px rgba(0,0,0,0.25)" }}>
          <ShopFavicon domain={article.domain || ""} name={article.shopName || article.title} size={faviconSize} />
        </div>
        <span style={{ color: "#fff", fontWeight: 800, fontSize: featured ? 18 : 14, letterSpacing: "-0.3px", textShadow: "0 1px 8px rgba(0,0,0,0.3)" }}>{article.shopName}</span>
        {article.discountPct ? (
          <span style={{ color: "#fff", background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.35)", borderRadius: 100, padding: "2px 12px", fontSize: 12, fontWeight: 800 }}>
            zľavy až -{article.discountPct}%
          </span>
        ) : null}
      </div>
    );

  const badge = (
    <span style={{ position: "absolute", top: 12, left: 12, zIndex: 1, fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 100, color: "#fff", background: isSale ? ORANGE_DARK : GREEN }}>
      {isSale ? (article.discountPct ? `AŽ -${article.discountPct}%` : "🏷️ Výpredaj") : "💡 Tip"}
    </span>
  );

  // ── Veľká featured karta (hero) ──
  if (featured) {
    return (
      <a href={`/blog/${article.slug}`} className="article-card article-card-featured"
        style={{ display: "grid", gridTemplateColumns: "minmax(0,42%) 1fr", textDecoration: "none", color: "#1d1d1f", background: "#fff", borderRadius: 18, border: "1.5px solid #eceff3", overflow: "hidden", boxShadow: "0 4px 18px rgba(0,0,0,0.06)", transition: "transform .18s, box-shadow .18s, border-color .15s", minHeight: 240 }}>
        <div style={{ position: "relative", background: "#f8f9fa", minHeight: 220 }}>{badge}{media(240, 64)}</div>
        <div style={{ padding: "26px 28px", display: "flex", flexDirection: "column" }}>
          {article.shopName && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <ShopFavicon domain={article.domain || ""} name={article.shopName} size={22} />
              <span style={{ fontSize: 13, color: "#666", fontWeight: 700 }}>{article.shopName}</span>
              <span style={{ fontSize: 12, color: "#c0c4cc" }}>•</span>
              <span style={{ fontSize: 12, color: "#9ca3af" }}>{date}</span>
            </div>
          )}
          <div style={{ fontWeight: 800, fontSize: "clamp(19px,2.4vw,26px)", lineHeight: 1.25, letterSpacing: "-0.4px", marginBottom: 12 }}>{article.title}</div>
          <div style={{ fontSize: 15, color: "#5b6472", lineHeight: 1.65, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}>{article.perex}</div>
          <span style={{ marginTop: "auto", paddingTop: 18, fontSize: 15, color: ORANGE_DARK, fontWeight: 800 }}>Čítať článok →</span>
        </div>
      </a>
    );
  }

  // ── Bežná karta ──
  return (
    <a href={`/blog/${article.slug}`} className="article-card"
      style={{ display: "flex", flexDirection: "column", textDecoration: "none", color: "#1d1d1f", background: "#fff", borderRadius: 16, border: "1.5px solid #eceff3", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", transition: "transform .18s, box-shadow .18s, border-color .15s" }}>
      <div style={{ position: "relative", height: 190, background: "#f8f9fa", overflow: "hidden" }}>{badge}{media(190, 48)}</div>
      <div style={{ padding: "16px 18px", flex: 1, display: "flex", flexDirection: "column" }}>
        {article.shopName && (
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
            <ShopFavicon domain={article.domain || ""} name={article.shopName} size={18} />
            <span style={{ fontSize: 12, color: "#666", fontWeight: 600 }}>{article.shopName}</span>
          </div>
        )}
        <div style={{ fontWeight: 800, fontSize: 16, lineHeight: 1.35, marginBottom: 8, letterSpacing: "-0.2px" }}>{article.title}</div>
        <div style={{ fontSize: 13.5, color: "#6b7280", lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}>{article.perex}</div>
      </div>
      <div style={{ padding: "10px 18px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #f5f5f5" }}>
        <span style={{ fontSize: 12, color: article.validTo ? "#c2410c" : "#9ca3af", fontWeight: article.validTo ? 700 : 400 }}>
          {article.validTo ? `⏳ do ${new Date(article.validTo).toLocaleDateString("sk-SK")}` : date}
        </span>
        <span style={{ fontSize: 13, color: ORANGE_DARK, fontWeight: 700 }}>Čítať →</span>
      </div>
    </a>
  );
}
