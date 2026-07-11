import { T } from "@/lib/design-tokens";
import type { PriceDrop } from "@/lib/heureka/price-history";
import { getFormattedProductPrices, getPreferredDisplayCurrency, normalizeCurrencyCode } from "@/lib/price";
import { getOfferOutbound } from "@/lib/heureka/affiliate";
import { outboundClickType } from "@/lib/outbound-ui";
import TrackedLink from "@/components/TrackedLink";
import { normalizeShopSlug } from "@/lib/slug";

interface ShopPriceDropsProps {
  drops: PriceDrop[];
  capitalized: string;
  shopSlug: string;
}

/**
 * Sekcia 4 — Najväčší pokles ceny.
 * Renderuje sa LEN ak existuje história cien (drops.length > 0).
 * Žiadne falošné poklesy — dáta prichádzajú z product_price_history
 * (min. 2 snapshoty, sanity filter v getBiggestPriceDropsByDomain).
 */
export default function ShopPriceDrops({ drops, capitalized, shopSlug }: ShopPriceDropsProps) {
  if (!drops.length) return null;

  return (
    <div className="card-section">
      <div className="section-title">📉 Najväčší pokles ceny v {capitalized}</div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        gap: 14,
      }}>
        {drops.slice(0, 6).map((d) => {
          // Centrálna outbound logika (PROJECT_VISION §14) — bez lokálneho fallbacku
          const outbound = getOfferOutbound({ affiliateUrl: d.affiliateUrl, url: d.productUrl, name: d.name });
          const ctaIsHeureka = outbound.kind === "heureka_fallback";
          const currency = normalizeCurrencyCode(d.currency);
          // Preferovaná mena zobrazenia podľa domény (.cz → CZK, .sk → EUR) — centrálne pravidlo v lib/price.ts
          const displayCurrency = currency ? getPreferredDisplayCurrency(d.domain, currency) : null;
          const oldPrice = currency && displayCurrency ? getFormattedProductPrices(d.oldPrice, currency, undefined, displayCurrency) : null;
          const newPrice = currency && displayCurrency ? getFormattedProductPrices(d.newPrice, currency, undefined, displayCurrency) : null;
          return (
            <div key={d.productUrl} style={{
              border: `1px solid ${T.border}`,
              borderRadius: T.rLg,
              padding: 14,
              background: T.white,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              boxShadow: T.shadowXs,
            }}>
              <div style={{ position: "relative", height: 120, borderRadius: T.rMd, overflow: "hidden", background: T.bgAlt, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {d.imgUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.imgUrl} alt={d.name} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                ) : (
                  <span style={{ fontSize: 32 }}>🛒</span>
                )}
                <span style={{
                  position: "absolute", top: 8, left: 8,
                  fontSize: 12, fontWeight: 800, color: T.white,
                  background: T.green, padding: "3px 9px", borderRadius: T.rFull,
                }}>−{d.dropPct}%</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, lineHeight: 1.35, minHeight: 34, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}>
                {d.name}
              </div>
              {oldPrice && newPrice && (
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: 12, color: T.textFaint, textDecoration: "line-through" }}>
                      {oldPrice.primary}
                    </span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: T.greenDark }}>
                      {newPrice.primary}
                    </span>
                  </div>
                  {newPrice.secondary && (
                    <span title="Orientačný prepočet podľa aktuálne nastaveného kurzu." style={{ fontSize: 11, color: T.textMuted }}>
                      {newPrice.secondary}
                    </span>
                  )}
                </div>
              )}
              <TrackedLink
                href={outbound.url}
                target="_blank"
                rel="nofollow noopener noreferrer"
                type={outboundClickType(outbound.kind)}
                shopSlug={normalizeShopSlug(shopSlug)}
                destinationDomain={ctaIsHeureka ? "www.heureka.sk" : d.domain}
                style={{
                  display: "block", textAlign: "center",
                  padding: "9px 12px", borderRadius: T.rMd,
                  background: `linear-gradient(135deg, ${T.green} 0%, ${T.greenDark} 100%)`,
                  color: T.white, fontWeight: 700, fontSize: 13,
                  textDecoration: "none", boxShadow: T.shadowGreen,
                }}
              >
                {ctaIsHeureka ? "Porovnať na Heureke →" : "Do obchodu →"}
              </TrackedLink>
            </div>
          );
        })}
      </div>
    </div>
  );
}
