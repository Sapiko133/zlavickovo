import { T } from "@/lib/design-tokens";
import type { HkProduct } from "@/lib/heureka/types";
import { toProductSlug } from "@/lib/heureka/query";
import { formatPrice } from "@/lib/heureka/query";
import TrackedLink from "@/components/TrackedLink";
import ShopFavicon from "@/components/ShopFavicon";
import { normalizeShopSlug } from "@/lib/slug";

interface ShopProductsProps {
  products: HkProduct[];
  capitalized: string;
  shopSlug: string;
  /** Obchod má aktuálne kupón s kódom — len shop-level badge, NIE tvrdenie o produkte. */
  hasCoupon: boolean;
}

/**
 * Sekcia „Nakupované produkty z obchodu".
 * Zobrazí sa LEN ak existujú produkty (products.length > 0).
 * Názov + obrázok → interne /produkt/[slug] (SEO), tlačidlo → outbound do obchodu.
 * Coupon badge je shop-level informácia, nepredstiera platnosť na konkrétny produkt.
 */
export default function ShopProducts({ products, capitalized, shopSlug, hasCoupon }: ShopProductsProps) {
  if (!products.length) return null;

  return (
    <div className="card-section">
      <div className="section-title" style={{ justifyContent: "space-between" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          🛍️ Nakupované produkty z obchodu {capitalized}
        </span>
        {hasCoupon && (
          <span style={{
            fontSize: 11, fontWeight: 700, color: T.greenDeep,
            background: T.greenMid, padding: "4px 10px", borderRadius: T.rFull,
          }}>
            kupón dostupný
          </span>
        )}
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
        gap: 14,
      }}>
        {products.map((p) => {
          const productHref = `/produkt/${toProductSlug(p.name, p.id)}`;
          const outbound = p.affiliate_url || p.url;
          const priceStr = formatPrice(p.price, p.domain);
          return (
            <div key={p.id} style={{
              border: `1px solid ${T.border}`,
              borderRadius: T.rLg,
              padding: 14,
              background: T.white,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              boxShadow: T.shadowXs,
            }}>
              <a href={productHref} style={{ textDecoration: "none", color: "inherit" }}>
                <div style={{ height: 120, borderRadius: T.rMd, overflow: "hidden", background: T.bgAlt, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {p.img_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.img_url} alt={p.name} loading="lazy" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                  ) : (
                    <ShopFavicon domain={p.domain} name={capitalized} size={40} />
                  )}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, lineHeight: 1.35, marginTop: 10, minHeight: 34, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}>
                  {p.name}
                </div>
              </a>
              {priceStr && (
                <div style={{ fontSize: 16, fontWeight: 800, color: T.greenDark }}>
                  {priceStr}
                </div>
              )}
              <TrackedLink
                href={outbound}
                target="_blank"
                rel="nofollow noopener noreferrer"
                type="product_outbound"
                shopSlug={normalizeShopSlug(shopSlug)}
                productSlug={toProductSlug(p.name, p.id)}
                destinationDomain={p.domain}
                style={{
                  display: "block", textAlign: "center", marginTop: "auto",
                  padding: "9px 12px", borderRadius: T.rMd,
                  background: `linear-gradient(135deg, ${T.green} 0%, ${T.greenDark} 100%)`,
                  color: T.white, fontWeight: 700, fontSize: 13,
                  textDecoration: "none", boxShadow: T.shadowGreen,
                }}
              >
                Prejsť do obchodu →
              </TrackedLink>
            </div>
          );
        })}
      </div>
    </div>
  );
}
