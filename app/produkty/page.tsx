import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import ShopFavicon from "@/components/ShopFavicon";
import { getProducts, toProductSlug, formatPrice } from "@/lib/heureka/query";
import type { HkProduct } from "@/lib/heureka/types";

export const revalidate = 3600;

const CATEGORY_LABELS: Record<string, { label: string; emoji: string; color: string; bg: string }> = {
  krasa:   { label: "Krása",   emoji: "💄", color: "#db2777", bg: "#fdf2f8" },
  byvanie: { label: "Bývanie", emoji: "🏠", color: "#7C3AED", bg: "#ede9fe" },
  sport:   { label: "Šport",   emoji: "⚽", color: "#FF6900", bg: "#fed7aa" },
};

const PAGE_SIZE = 24;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ kategoria?: string }>;
}) {
  const { kategoria } = await searchParams;
  const cat = kategoria ? CATEGORY_LABELS[kategoria] : null;
  const title = cat
    ? `${cat.label} produkty so zľavou | Zlavickovo.sk`
    : "Produkty so zľavou | Zlavickovo.sk";
  return {
    title,
    description: "Porovnaj ceny a nájdi najlepšie produkty so zľavou od overených predajcov.",
    alternates: { canonical: "https://www.zlavickovo.sk/produkty" },
  };
}

export default async function ProduktyPage({
  searchParams,
}: {
  searchParams: Promise<{ kategoria?: string; strana?: string }>;
}) {
  const { kategoria, strana } = await searchParams;
  const page = Math.max(1, parseInt(strana ?? "1") || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const { products, total } = await getProducts(PAGE_SIZE, offset, kategoria);
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const activeCat = kategoria ? CATEGORY_LABELS[kategoria] : null;

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "system-ui, -apple-system, sans-serif", color: "#1d1d1f" }}>
      <style>{`
        .prod-card { transition: transform .15s, box-shadow .15s, border-color .15s; }
        .prod-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.09) !important; border-color: #22C55E !important; }
      `}</style>
      <Nav />

      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #f0f0f0", padding: "32px 24px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ fontSize: 12, color: "#999", marginBottom: 8 }}>
            <a href="/" style={{ color: "#999", textDecoration: "none" }}>Zlavickovo</a>
            {" › "}
            <span style={{ color: "#374151", fontWeight: 600 }}>Produkty</span>
          </div>
          <h1 style={{ fontSize: "clamp(22px, 4vw, 32px)", fontWeight: 800, margin: "0 0 6px", letterSpacing: "-0.5px" }}>
            {activeCat ? `${activeCat.emoji} ${activeCat.label} so zľavou` : "Produkty so zľavou"}
          </h1>
          <p style={{ fontSize: 14, color: "#666", margin: 0 }}>
            {total > 0
              ? `${total.toLocaleString("sk-SK")} produktov od overených predajcov`
              : "Produkty čoskoro pribudnú"}
          </p>
        </div>
      </div>

      {/* Category filter */}
      <div style={{ background: "#fff", borderBottom: "1px solid #f0f0f0" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "10px 24px", display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none" }}>
          <a
            href="/produkty"
            style={{
              padding: "6px 16px", borderRadius: 100, fontSize: 13, fontWeight: 600,
              textDecoration: "none", whiteSpace: "nowrap",
              background: !kategoria ? "#22C55E" : "#f5f5f5",
              color: !kategoria ? "#fff" : "#555",
            }}
          >
            Všetky
          </a>
          {Object.entries(CATEGORY_LABELS).map(([slug, c]) => (
            <a
              key={slug}
              href={`/produkty?kategoria=${slug}`}
              style={{
                padding: "6px 16px", borderRadius: 100, fontSize: 13, fontWeight: 600,
                textDecoration: "none", whiteSpace: "nowrap",
                background: kategoria === slug ? c.color : "#f5f5f5",
                color: kategoria === slug ? "#fff" : "#555",
              }}
            >
              {c.emoji} {c.label}
            </a>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 24px 64px" }}>
        {products.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 20px", color: "#aaa" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📦</div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: "#666", marginBottom: 8 }}>Žiadne produkty</h2>
            <p style={{ margin: 0, fontSize: 14 }}>
              Produkty čoskoro pribudnú. Skúste to prosím neskôr.
            </p>
          </div>
        ) : (
          <>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: 16,
            }}>
              {products.map((product: HkProduct) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 40, flexWrap: "wrap", alignItems: "center" }}>
                {page > 1 && (
                  <a
                    href={`/produkty?${kategoria ? `kategoria=${kategoria}&` : ""}strana=${page - 1}`}
                    style={{ padding: "9px 20px", borderRadius: 10, border: "1.5px solid #e8e8e8", fontSize: 14, fontWeight: 600, textDecoration: "none", color: "#555", background: "#fff" }}
                  >
                    ← Späť
                  </a>
                )}
                <span style={{ padding: "9px 16px", fontSize: 13, color: "#888" }}>
                  {page} / {totalPages}
                </span>
                {page < totalPages && (
                  <a
                    href={`/produkty?${kategoria ? `kategoria=${kategoria}&` : ""}strana=${page + 1}`}
                    style={{ padding: "9px 20px", borderRadius: 10, border: "1.5px solid #e8e8e8", fontSize: 14, fontWeight: 600, textDecoration: "none", color: "#555", background: "#fff" }}
                  >
                    Ďalej →
                  </a>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <Footer />
    </div>
  );
}

function ProductCard({ product }: { product: HkProduct }) {
  const slug = toProductSlug(product.name, product.id);
  const price = formatPrice(product.price);

  return (
    <a
      href={`/produkt/${slug}`}
      className="prod-card"
      style={{
        display: "flex", flexDirection: "column",
        background: "#fff", borderRadius: 14, border: "1.5px solid #e8e8e8",
        textDecoration: "none", color: "#1d1d1f", overflow: "hidden",
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
      }}
    >
      {/* Obrázok */}
      <div style={{ aspectRatio: "1", background: "#f8f9fa", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {product.img_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.img_url}
            alt={product.name}
            loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "contain", padding: 10 }}
          />
        ) : (
          <ShopFavicon domain={product.domain} name={product.domain} size={48} />
        )}
      </div>

      {/* Info */}
      <div style={{ padding: "12px 14px 14px", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, lineHeight: 1.4, color: "#1d1d1f",
          display: "-webkit-box", WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical" as const, overflow: "hidden",
        }}>
          {product.name}
        </div>
        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {price ? (
            <span style={{ fontSize: 15, fontWeight: 800, color: "#22C55E" }}>{price}</span>
          ) : (
            <span style={{ fontSize: 12, color: "#aaa" }}>Cena na webe</span>
          )}
          <span style={{ fontSize: 10, color: "#bbb" }}>{product.domain}</span>
        </div>
      </div>
    </a>
  );
}
