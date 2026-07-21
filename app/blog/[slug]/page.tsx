import {
  getAllArticles,
  getArticleBySlug,
  getPublishedArticles,
  type Article,
  type SaleProduct,
} from "@/lib/articles";
import { formatAmount } from "@/lib/heureka/query";
import { getCouponsByShop } from "@/lib/dognet";
import { normalizeShopSlug } from "@/lib/slug";
import ShopFavicon from "@/components/ShopFavicon";
import TrackedLink from "@/components/TrackedLink";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const revalidate = 3600;
export const dynamicParams = true;

type Props = { params: Promise<{ slug: string }> };

const BASE = "https://www.zlavickovo.sk";
const GREEN = "#22C55E";
const ORANGE_DARK = "#EA580C";

export async function generateStaticParams() {
  // Statické len legacy/tip články; sale články sa generujú on-demand (ISR).
  try {
    const all = await getAllArticles();
    return all.filter((a) => a.type === "tip").map((a) => ({ slug: a.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const a = await getArticleBySlug(slug);
  if (!a) return {};
  return {
    title: `${a.title} | Zlavickovo.sk`,
    description: a.perex,
    alternates: { canonical: `${BASE}/blog/${slug}` },
    openGraph: {
      title: a.title,
      description: a.perex,
      type: "article",
      publishedTime: a.date,
      images: a.imageUrl ? [a.imageUrl] : undefined,
    },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) notFound();

  if (article.type === "sale") return <SaleArticle article={article} />;
  return <TipArticle article={article} />;
}

// ─────────────────────────────────────────────────────────────
// SALE ČLÁNOK — výpredaj jedného obchodu
// ─────────────────────────────────────────────────────────────
async function SaleArticle({ article }: { article: Article }) {
  const shopSlug = article.shopSlug || (article.shopName ? normalizeShopSlug(article.shopName) : "");
  const products = article.products ?? [];

  // Kupóny obchodu (bez zobrazenia kódu — kód sa odhalí až na /kupony/[slug])
  let coupons: any[] = [];
  if (article.shopName) {
    try {
      coupons = (await getCouponsByShop(article.shopName)) as any[];
    } catch {}
  }
  const couponTitles = coupons
    .map((c) => c.title || c.name || c.description)
    .filter((t): t is string => !!t)
    .slice(0, 5);

  // Súvisiace akcie iných obchodov
  let related: Article[] = [];
  try {
    related = (await getPublishedArticles("sale"))
      .filter((a) => a.slug !== article.slug && a.shopSlug !== article.shopSlug)
      .slice(0, 4);
  } catch {}

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.perex,
    datePublished: article.date,
    dateModified: article.updatedAt,
    image: article.imageUrl ? [article.imageUrl] : undefined,
    author: { "@type": "Organization", name: "Zlavickovo" },
    publisher: { "@type": "Organization", name: "Zlavickovo", url: BASE },
    mainEntityOfPage: { "@type": "WebPage", "@id": `${BASE}/blog/${article.slug}` },
  };

  return (
    <div style={{ minHeight: "100vh", background: "#fff", fontFamily: "system-ui,-apple-system,sans-serif", color: "#1d1d1f" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <style>{`
        .sale-prod { transition: transform .15s, box-shadow .15s, border-color .15s; }
        .sale-prod:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.10) !important; border-color: ${GREEN} !important; }
        .rel-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.10) !important; }
        @media(max-width:640px){ .sale-grid { grid-template-columns: repeat(2,1fr) !important; } }
      `}</style>
      <Nav />

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "28px 20px 80px" }}>
        {/* Breadcrumb */}
        <div style={{ fontSize: 12, color: "#999", marginBottom: 16 }}>
          <a href="/" style={{ color: "#999", textDecoration: "none" }}>Zlavickovo</a>{" › "}
          <a href="/akcie" style={{ color: "#999", textDecoration: "none" }}>Akcie</a>{" › "}
          <span style={{ color: GREEN, fontWeight: 600 }}>{article.shopName}</span>
        </div>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
          <ShopFavicon domain={article.domain || ""} name={article.shopName || ""} size={52} />
          <div>
            {article.discountPct ? (
              <span style={{ display: "inline-block", fontSize: 12, fontWeight: 800, color: "#fff", background: ORANGE_DARK, borderRadius: 100, padding: "3px 12px", marginBottom: 6 }}>
                AŽ -{article.discountPct}%
              </span>
            ) : null}
            <div style={{ fontSize: 13, color: "#888", fontWeight: 600 }}>{article.domain}</div>
          </div>
        </div>

        <h1 style={{ fontSize: "clamp(24px,4vw,38px)", fontWeight: 800, letterSpacing: "-0.6px", lineHeight: 1.15, margin: "0 0 12px" }}>
          {article.title}
        </h1>
        <p style={{ fontSize: 16, color: "#555", lineHeight: 1.7, margin: "0 0 12px", maxWidth: 760 }}>{article.perex}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700,
            padding: "5px 12px", borderRadius: 100,
            background: article.validTo ? "#fff7ed" : "#f0fdf4",
            color: article.validTo ? "#c2410c" : "#166534",
            border: `1px solid ${article.validTo ? "#fed7aa" : "#bbf7d0"}`,
          }}>
            ⏳ {article.validTo
              ? `Platí do ${new Date(article.validTo).toLocaleDateString("sk-SK")}`
              : "Priebežná akcia"}
          </span>
          <span style={{ fontSize: 12, color: "#aaa" }}>
            Aktualizované {new Date(article.updatedAt).toLocaleDateString("sk-SK")}
          </span>
        </div>

        {/* Hero image */}
        {article.imageUrl && (
          <div style={{ borderRadius: 18, overflow: "hidden", background: "#f8f9fa", marginBottom: 24, maxHeight: 360, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={article.imageUrl} alt={article.title} style={{ width: "100%", maxHeight: 360, objectFit: "contain", padding: 16 }} />
          </div>
        )}

        {/* CTA */}
        {article.affiliateUrl && (
          <TrackedLink
            href={article.affiliateUrl}
            target="_blank"
            rel="nofollow noopener noreferrer"
            type="action_outbound"
            shopSlug={shopSlug || null}
            destinationDomain={article.domain || null}
            style={{
              display: "inline-flex", alignItems: "center", gap: 10,
              padding: "15px 30px", borderRadius: 14, background: GREEN, color: "#fff",
              fontWeight: 800, fontSize: 16, textDecoration: "none",
              boxShadow: "0 4px 18px rgba(34,197,94,0.30)", marginBottom: 40,
            }}
          >
            Prejsť na výpredaj v {article.shopName} →
          </TrackedLink>
        )}

        {/* Obsah článku */}
        {article.content && (
          <>
            <style>{`
              .sale-body h2 { font-size: 22px; font-weight: 800; margin: 32px 0 12px; letter-spacing: -0.3px; color: #1d1d1f; }
              .sale-body p  { font-size: 15px; line-height: 1.8; color: #444; margin: 0 0 16px; max-width: 760px; }
              .sale-body ul { padding-left: 22px; margin: 0 0 18px; max-width: 760px; }
              .sale-body li { font-size: 15px; line-height: 1.75; color: #444; margin-bottom: 6px; }
              .sale-body strong { color: #1d1d1f; }
            `}</style>
            <div className="sale-body" style={{ marginBottom: 40 }} dangerouslySetInnerHTML={{ __html: article.content }} />
          </>
        )}

        {/* Product grid */}
        {products.length > 0 && (
          <section style={{ marginBottom: 48 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 18px", letterSpacing: "-0.3px" }}>
              🛍️ Zľavnené produkty
            </h2>
            <div className="sale-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 16 }}>
              {products.map((p, i) => (
                <SaleProductCard key={`${p.name}-${i}`} product={p} shopSlug={shopSlug} domain={article.domain || ""} />
              ))}
            </div>
          </section>
        )}

        {/* Kupóny obchodu */}
        {shopSlug && (
          <section style={{ marginBottom: 48 }}>
            <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 18, padding: "26px 24px" }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 6px" }}>🏷️ Kupóny pre {article.shopName}</h2>
              <p style={{ fontSize: 14, color: "#4b5563", margin: "0 0 16px" }}>
                Pred nákupom skontroluj dostupné zľavové kódy pre {article.shopName}.
              </p>
              {couponTitles.length > 0 && (
                <ul style={{ margin: "0 0 18px", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
                  {couponTitles.map((t, i) => (
                    <li key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#166534" }}>
                      <span>🎟️</span>{t}
                    </li>
                  ))}
                </ul>
              )}
              <a href={`/kupony/${shopSlug}`} style={{ display: "inline-block", padding: "12px 24px", borderRadius: 12, background: GREEN, color: "#fff", fontWeight: 700, fontSize: 15, textDecoration: "none" }}>
                Zobraziť všetky kupóny pre {article.shopName} →
              </a>
            </div>
          </section>
        )}

        {/* Súvisiace akcie */}
        {related.length > 0 && (
          <section>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 18px", letterSpacing: "-0.3px" }}>📰 Ďalšie akcie</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 16 }}>
              {related.map((r) => (
                <a key={r.slug} href={`/blog/${r.slug}`} className="rel-card"
                  style={{ display: "flex", flexDirection: "column", textDecoration: "none", color: "#1d1d1f", background: "#fff", borderRadius: 14, border: "1.5px solid #eceff3", overflow: "hidden", boxShadow: "0 2px 6px rgba(0,0,0,0.04)", transition: "transform .15s, box-shadow .15s" }}>
                  {r.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.imageUrl} alt={r.title} loading="lazy" style={{ width: "100%", height: 120, objectFit: "cover" }} />
                  )}
                  <div style={{ padding: "14px 16px" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.4 }}>{r.title}</div>
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}
      </div>
      <Footer />
    </div>
  );
}

function SaleProductCard({ product, shopSlug, domain }: { product: SaleProduct; shopSlug: string; domain: string }) {
  const showOld = product.oldPrice != null && product.newPrice != null && product.oldPrice > product.newPrice;
  return (
    <TrackedLink
      href={product.affiliateUrl}
      target="_blank"
      rel="nofollow noopener noreferrer"
      className="sale-prod"
      type="product_outbound"
      shopSlug={shopSlug || null}
      destinationDomain={domain || null}
      style={{ display: "flex", flexDirection: "column", background: "#fff", borderRadius: 14, border: "1.5px solid #e8e8e8", textDecoration: "none", color: "#1d1d1f", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
    >
      <div style={{ aspectRatio: "1", background: "#f8f9fa", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {product.imgUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.imgUrl} alt={product.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 10 }} />
        ) : (
          <ShopFavicon domain={domain} name={domain} size={44} />
        )}
      </div>
      <div style={{ padding: "12px 14px 14px", flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}>
          {product.name}
        </div>
        <div style={{ marginTop: "auto" }}>
          {product.newPrice != null ? (
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: GREEN }}>{formatAmount(product.newPrice, product.currency)}</span>
              {showOld && (
                <span style={{ fontSize: 12, color: "#9ca3af", textDecoration: "line-through" }}>{formatAmount(product.oldPrice!, product.currency)}</span>
              )}
            </div>
          ) : (
            <span style={{ fontSize: 12, color: "#aaa" }}>Cena na webe</span>
          )}
          <div style={{ fontSize: 12, color: ORANGE_DARK, fontWeight: 700, marginTop: 6 }}>Kúpiť →</div>
        </div>
      </div>
    </TrackedLink>
  );
}

// ─────────────────────────────────────────────────────────────
// TIP ČLÁNOK — evergreen (pôvodný blog layout)
// ─────────────────────────────────────────────────────────────
async function TipArticle({ article }: { article: Article }) {
  const shopSlug = article.shopName ? normalizeShopSlug(article.shopName) : null;
  let others: Article[] = [];
  try {
    others = (await getAllArticles()).filter((a) => a.slug !== article.slug && a.type === "tip").slice(0, 5);
  } catch {}

  return (
    <div style={{ minHeight: "100vh", background: "#fff", fontFamily: "'Inter', system-ui, sans-serif", color: "#1d1d1f" }}>
      <Nav />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px 80px", display: "flex", gap: 48, alignItems: "flex-start" }}>
        <article style={{ flex: 1, minWidth: 0, maxWidth: 720 }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
              {article.shopName && <span style={{ fontSize: 12, color: "#666" }}>{article.shopName}</span>}
              <span style={{ fontSize: 12, color: "#666" }}>{new Date(article.date).toLocaleDateString("sk-SK")}</span>
            </div>
            <h1 style={{ fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 800, letterSpacing: "-0.5px", lineHeight: 1.2, margin: "0 0 16px" }}>{article.title}</h1>
            <p style={{ fontSize: 16, color: "#666", lineHeight: 1.7, margin: 0 }}>{article.perex}</p>
          </div>
          <hr style={{ border: "none", borderTop: "1px solid #e5e7eb", margin: "32px 0" }} />
          <style>{`
            article h2 { font-size: 22px; font-weight: 700; margin: 36px 0 14px; letter-spacing: -0.3px; color: #1d1d1f; }
            article h3 { font-size: 17px; font-weight: 700; margin: 24px 0 10px; color: #1d1d1f; }
            article p  { font-size: 15px; line-height: 1.8; color: #444; margin: 0 0 16px; }
            article ul, article ol { padding-left: 22px; margin: 0 0 16px; }
            article li { font-size: 15px; line-height: 1.8; color: #444; margin-bottom: 6px; }
            article strong { color: #1d1d1f; }
            article a { color: #22C55E; }
          `}</style>
          {article.content && <div dangerouslySetInnerHTML={{ __html: article.content }} />}
          {shopSlug && (
            <div style={{ marginTop: 48, padding: "28px", background: "#F0FDF4", borderRadius: 16, border: "1px solid #BBF7D0", textAlign: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Nájdi zľavový kód pre {article.shopName}</div>
              <div style={{ fontSize: 14, color: "#666", marginBottom: 20 }}>Aktuálne overené kupóny a promo kódy na jednom mieste.</div>
              <a href={`/kupony/${shopSlug}`} style={{ display: "inline-block", padding: "12px 24px", borderRadius: 12, background: "#22C55E", color: "#fff", fontWeight: 700, fontSize: 15, textDecoration: "none" }}>
                Zobraziť kupóny pre {article.shopName} →
              </a>
            </div>
          )}
        </article>
        <aside style={{ width: 280, flexShrink: 0, position: "sticky", top: 72, display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ background: "#f9fafb", borderRadius: 16, padding: "20px", border: "1px solid #e5e7eb" }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Ďalšie články</div>
            {others.map((p) => (
              <a key={p.slug} href={`/blog/${p.slug}`} style={{ display: "block", padding: "10px 0", borderBottom: "1px solid #e5e7eb", textDecoration: "none" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1d1d1f", lineHeight: 1.4 }}>{p.title}</div>
              </a>
            ))}
          </div>
        </aside>
      </div>
      <Footer />
    </div>
  );
}
