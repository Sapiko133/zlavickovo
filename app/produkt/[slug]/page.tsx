import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import ShopFavicon from "@/components/ShopFavicon";
import {
  getProductById,
  getRelatedProducts,
  toProductSlug,
  idFromSlug,
  getTopProductIds,
  formatPrice,
} from "@/lib/heureka/query";
import type { HkProduct } from "@/lib/heureka/types";

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  const products = await getTopProductIds(100);
  return products.map((p) => ({ slug: toProductSlug(p.name, p.id) }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const id = idFromSlug(slug);
  if (!id) return {};
  const product = await getProductById(id);
  if (!product) return {};
  const price = formatPrice(product.price);
  return {
    title: `${product.name}${price ? ` – ${price}` : ""} | Zlavickovo.sk`,
    description:
      product.description ||
      `Kúp ${product.name} za najlepšiu cenu na ${product.domain}. Overený predajca.`,
    alternates: { canonical: `https://www.zlavickovo.sk/produkt/${slug}` },
    openGraph: {
      title: product.name,
      description: product.description || `${product.name} na ${product.domain}`,
      images: product.img_url ? [{ url: product.img_url }] : [],
      type: "website",
    },
  };
}

export default async function ProduktPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const id = idFromSlug(slug);
  if (!id) notFound();

  const product = await getProductById(id);
  if (!product) notFound();

  const related = await getRelatedProducts(product, 4);
  const price = formatPrice(product.price);

  const priceNum = parseFloat(product.price.replace(/[^\d.,]/g, "").replace(",", "."));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description || undefined,
    image: product.img_url || undefined,
    brand: { "@type": "Brand", name: product.domain },
    offers: {
      "@type": "Offer",
      price: isNaN(priceNum) ? undefined : priceNum,
      priceCurrency: "EUR",
      availability: "https://schema.org/InStock",
      url: product.affiliate_url,
      seller: { "@type": "Organization", name: product.domain },
    },
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "system-ui, -apple-system, sans-serif", color: "#1d1d1f" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <style>{`
        .rel-card { transition: transform .15s, border-color .15s; }
        .rel-card:hover { transform: translateY(-2px); border-color: #22C55E !important; }
        @media(max-width: 700px) {
          .prod-layout { flex-direction: column !important; }
          .prod-img-wrap { width: 100% !important; }
        }
      `}</style>
      <Nav />

      {/* Breadcrumb */}
      <div style={{ background: "#fff", borderBottom: "1px solid #f0f0f0", padding: "10px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", fontSize: 12, color: "#999", display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <a href="/" style={{ color: "#999", textDecoration: "none" }}>Zlavickovo</a>
          <span>›</span>
          <a href="/produkty" style={{ color: "#999", textDecoration: "none" }}>Produkty</a>
          <span>›</span>
          <a href={`/produkty?kategoria=${product.category}`} style={{ color: "#999", textDecoration: "none" }}>
            {product.category}
          </a>
          <span>›</span>
          <span style={{ color: "#374151", fontWeight: 500 }}>
            {product.name.length > 50 ? product.name.slice(0, 50) + "…" : product.name}
          </span>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px 64px" }}>

        {/* Hlavný obsah */}
        <div className="prod-layout" style={{ display: "flex", gap: 40, alignItems: "flex-start" }}>

          {/* Obrázok */}
          <div className="prod-img-wrap" style={{ width: 320, flexShrink: 0 }}>
            <div style={{
              background: "#fff", borderRadius: 18, border: "1.5px solid #e8e8e8",
              padding: 24, aspectRatio: "1",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            }}>
              {product.img_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.img_url}
                  alt={product.name}
                  style={{ maxWidth: "100%", maxHeight: 260, objectFit: "contain" }}
                />
              ) : (
                <ShopFavicon domain={product.domain} name={product.domain} size={80} />
              )}
            </div>
          </div>

          {/* Detail */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Obchod */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <ShopFavicon domain={product.domain} name={product.domain} size={20} />
              <a
                href={`/kupony/${product.domain.replace(/\.(sk|cz|eu|com|net)$/, "").replace(/\./g, "-")}`}
                style={{ fontSize: 13, color: "#22C55E", textDecoration: "none", fontWeight: 600 }}
              >
                {product.domain}
              </a>
            </div>

            <h1 style={{ fontSize: "clamp(18px, 3vw, 26px)", fontWeight: 800, margin: "0 0 16px", letterSpacing: "-0.3px", lineHeight: 1.35 }}>
              {product.name}
            </h1>

            {product.description && (
              <p style={{ fontSize: 14, color: "#555", lineHeight: 1.75, margin: "0 0 20px", maxWidth: 560 }}>
                {product.description}
              </p>
            )}

            {/* Cena */}
            {price && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                  Cena
                </div>
                <div style={{ fontSize: 36, fontWeight: 900, color: "#22C55E", letterSpacing: "-1px" }}>
                  {price}
                </div>
              </div>
            )}

            {/* CTA */}
            <a
              href={product.affiliate_url}
              target="_blank"
              rel="nofollow noopener noreferrer"
              style={{
                display: "inline-flex", alignItems: "center", gap: 10,
                padding: "16px 32px", borderRadius: 14,
                background: "#22C55E", color: "#fff",
                fontWeight: 800, fontSize: 16, textDecoration: "none",
                boxShadow: "0 4px 18px rgba(34,197,94,0.30)",
              }}
            >
              Kúpiť na {product.domain} →
            </a>

            <p style={{ fontSize: 11, color: "#bbb", marginTop: 10, margin: "10px 0 0" }}>
              Partnerský odkaz · Cena overená pri poslednom importe XML feeda
            </p>
          </div>
        </div>

        {/* Súvisiace produkty */}
        {related.length > 0 && (
          <div style={{ marginTop: 56 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 18px", letterSpacing: "-0.3px" }}>
              Ďalšie produkty od {product.domain}
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
              {related.map((p: HkProduct) => {
                const rPrice = formatPrice(p.price);
                const rSlug = toProductSlug(p.name, p.id);
                return (
                  <a
                    key={p.id}
                    href={`/produkt/${rSlug}`}
                    className="rel-card"
                    style={{
                      background: "#fff", borderRadius: 12, border: "1.5px solid #e8e8e8",
                      padding: 16, textDecoration: "none", color: "#1d1d1f",
                      display: "flex", flexDirection: "column", gap: 8,
                    }}
                  >
                    {p.img_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.img_url}
                        alt={p.name}
                        loading="lazy"
                        style={{ width: "100%", height: 120, objectFit: "contain" }}
                      />
                    )}
                    <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>
                      {p.name.length > 60 ? p.name.slice(0, 60) + "…" : p.name}
                    </div>
                    {rPrice && (
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#22C55E" }}>{rPrice}</div>
                    )}
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* Späť */}
        <div style={{ marginTop: 40 }}>
          <a
            href="/produkty"
            style={{ fontSize: 14, color: "#22C55E", textDecoration: "none", fontWeight: 600 }}
          >
            ← Späť na produkty
          </a>
        </div>
      </div>

      <Footer />
    </div>
  );
}
