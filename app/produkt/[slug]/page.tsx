import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import ShopFavicon from "@/components/ShopFavicon";
import {
  getProductById,
  getRelatedProducts,
  getBestPurchase,
  toProductSlug,
  idFromSlug,
  getTopProductIds,
  formatAmount,
  formatProductPriceLines,
  parsePriceValue,
} from "@/lib/heureka/query";
import { normalizeCurrencyCode } from "@/lib/price";
import { getOfferOutbound } from "@/lib/heureka/affiliate";
import type { HkProduct } from "@/lib/heureka/types";
import { getCouponsByShop } from "@/lib/dognet";
import { normalizeShopSlug } from "@/lib/slug";
import TrackedLink from "@/components/TrackedLink";

type ShopCoupon = {
  code?: unknown;
  title?: unknown;
  name?: unknown;
  description?: unknown;
  affiliate_link?: unknown;
  url?: unknown;
};

function couponHasCode(coupon: ShopCoupon): boolean {
  return typeof coupon.code === "string" && coupon.code.trim() !== "";
}

function couponText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Prvý dostupný kupón (s kódom) a prvá akcia (bez kódu) obchodu — bez výpočtu ceny. */
function pickShopOffers(coupons: ShopCoupon[]): {
  coupon: { title: string } | null;
  deal: { title: string } | null;
} {
  let coupon: { title: string } | null = null;
  let deal: { title: string } | null = null;
  for (const c of coupons) {
    const hasCode = couponHasCode(c);
    const title = couponText(c.title) || couponText(c.name) || couponText(c.description);
    if (hasCode && !coupon) coupon = { title };
    else if (!hasCode && !deal && (c?.affiliate_link || c?.url)) deal = { title };
    if (coupon && deal) break;
  }
  return { coupon, deal };
}

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
  const price = formatProductPriceLines(product)?.primary ?? "";
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

  const [related, bestPurchase] = await Promise.all([
    getRelatedProducts(product, 4),
    getBestPurchase(product),
  ]);
  const price = formatProductPriceLines(product);
  const currency = normalizeCurrencyCode(product.currency_code);

  const priceNum = parsePriceValue(product.price);

  // Odporúčaná ponuka, hlavné CTA aj JSON-LD vychádzajú z TEJ ISTEJ ponuky —
  // box nesmie odporučiť obchod A a CTA poslať do obchodu B (PROJECT_VISION §9).
  const recommendedOffer = bestPurchase?.lowestOffer ?? null;
  const outbound = getOfferOutbound(recommendedOffer ?? product);
  const buyUrl = outbound.url;
  const ctaIsHeureka = outbound.kind === "heureka_fallback";
  const isMonetized = outbound.kind !== "direct_unmonetized";

  const recommendedDomain = recommendedOffer?.domain || product.domain;
  const bestPrice = recommendedOffer
    ? formatProductPriceLines({
        price: recommendedOffer.price,
        currency_code: recommendedOffer.currency_code,
        domain: recommendedOffer.domain,
      })
    : null;
  const bestDifference = bestPurchase && bestPurchase.priceDifference !== null
    ? formatAmount(bestPurchase.priceDifference, bestPurchase.lowestOffer.currency_code)
    : null;

  // Dostupné kupóny/akcie obchodu (bez výpočtu efektívnej ceny)
  let shopOffers: { coupon: { title: string } | null; deal: { title: string } | null } = {
    coupon: null,
    deal: null,
  };
  let recommendedCouponCount = 0;
  try {
    const sameRecommendedShop = recommendedDomain.toLowerCase() === product.domain.toLowerCase();
    const [productCoupons, recommendedCoupons] = sameRecommendedShop
      ? await getCouponsByShop(product.domain).then((coupons) => [coupons, coupons] as const)
      : await Promise.all([
          getCouponsByShop(product.domain),
          getCouponsByShop(recommendedDomain),
        ]);
    shopOffers = pickShopOffers(productCoupons);
    recommendedCouponCount = recommendedCoupons.filter(couponHasCode).length;
  } catch (error) {
    console.error("[product-shop-offers]", error);
  }
  const shopSlug = normalizeShopSlug(product.domain);
  const recommendedShopSlug = normalizeShopSlug(recommendedDomain);
  const hasOffers = Boolean(shopOffers.coupon || shopOffers.deal);

  const pageUrl = `https://www.zlavickovo.sk/produkt/${slug}`;

  // JSON-LD Offer iba so spoľahlivo známou cenou, menou a URL — inak sa vynechá.
  const schemaOffer = recommendedOffer
    ? { price: recommendedOffer.priceNum, currency: recommendedOffer.currency_code, seller: recommendedOffer.domain }
    : priceNum !== null && currency
      ? { price: priceNum, currency, seller: product.domain }
      : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        name: product.name,
        description: product.description || undefined,
        image: product.img_url || undefined,
        brand: { "@type": "Brand", name: product.domain },
        category: product.category || undefined,
        offers: schemaOffer
          ? {
              "@type": "Offer",
              price: schemaOffer.price,
              priceCurrency: schemaOffer.currency,
              availability: "https://schema.org/InStock",
              url: buyUrl,
              seller: { "@type": "Organization", name: schemaOffer.seller },
            }
          : undefined,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { name: "Domov", item: "https://www.zlavickovo.sk" },
          { name: "Produkty", item: "https://www.zlavickovo.sk/produkty" },
          ...(product.category
            ? [{ name: product.category, item: `https://www.zlavickovo.sk/produkty?kategoria=${encodeURIComponent(product.category)}` }]
            : []),
          { name: product.name, item: pageUrl },
        ].map((e, i) => ({ "@type": "ListItem", position: i + 1, ...e })),
      },
    ],
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "system-ui, -apple-system, sans-serif", color: "#1d1d1f" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
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
                  {price.primary}
                </div>
                {price.secondary && (
                  <div title="Orientačný prepočet podľa aktuálne nastaveného kurzu." style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
                    {price.secondary}
                  </div>
                )}
              </div>
            )}

            {bestPurchase && bestPrice && (
              <div style={{
                background: "#fff", border: "1.5px solid #d1fae5", borderRadius: 14,
                padding: "18px 20px", marginBottom: 24, maxWidth: 560,
                boxShadow: "0 2px 12px rgba(16,185,129,0.08)",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#16a34a", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                      {bestPurchase.isLowestVerified ? "Najvýhodnejšia kúpa" : "Dostupná ponuka"}
                    </div>
                    <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, marginBottom: 3 }}>
                      {bestPurchase.isLowestVerified ? `Najnižšia cena z ${bestPurchase.offerCount} porovnaných ponúk` : "Cena"}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "#111827", lineHeight: 1.2 }}>
                      {bestPrice.primary}
                    </div>
                    {bestPrice.secondary && (
                      <div title="Orientačný prepočet podľa aktuálne nastaveného kurzu." style={{ fontSize: 12, color: "#6b7280", marginTop: 3 }}>
                        {bestPrice.secondary}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#166534", fontSize: 13, fontWeight: 800 }}>
                    <ShopFavicon domain={recommendedDomain} name={recommendedDomain} size={22} />
                    {recommendedShopSlug ? (
                      <a href={`/kupony/${recommendedShopSlug}`} style={{ color: "#166534", textDecoration: "none" }}>
                        {recommendedDomain}
                      </a>
                    ) : (
                      <span>{recommendedDomain}</span>
                    )}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
                  <div style={{ background: "#f9fafb", borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, marginBottom: 4 }}>Rozdiel oproti 2. ponuke</div>
                    <div style={{ fontSize: 15, color: "#111827", fontWeight: 900 }}>
                      {!bestPurchase.secondOffer
                        ? "bez druhej ponuky"
                        : bestPurchase.priceDifference === null
                          ? "2. ponuka v inej mene"
                          : bestPurchase.priceDifference === 0
                            ? "rovnaká cena"
                            : `ušetríš ${bestDifference}`}
                    </div>
                  </div>
                  <div style={{ background: "#f9fafb", borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, marginBottom: 4 }}>Kupóny obchodu</div>
                    <div style={{ fontSize: 15, color: "#111827", fontWeight: 900 }}>
                      {recommendedCouponCount}
                    </div>
                  </div>
                  <div style={{ background: "#f9fafb", borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, marginBottom: 4 }}>Porovnané ponuky</div>
                    <div style={{ fontSize: 15, color: "#111827", fontWeight: 900 }}>
                      {bestPurchase.offerCount}
                    </div>
                  </div>
                </div>
                {recommendedCouponCount > 0 && (
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 10 }}>
                    Kupóny sa vzťahujú na obchod {recommendedDomain} — nemusia platiť na tento konkrétny produkt.
                  </div>
                )}
              </div>
            )}

            {/* Dostupné kupóny a akcie obchodu */}
            {hasOffers && (
              <div style={{
                background: "#f0fdf4", border: "1.5px solid #bbf7d0", borderRadius: 14,
                padding: "14px 18px", marginBottom: 24, maxWidth: 560,
              }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#15803d", marginBottom: 8 }}>
                  Dostupné kupóny a akcie v {product.domain}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                  {shopOffers.coupon && (
                    <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>
                      🏷️ <strong>Kupón:</strong> {shopOffers.coupon.title || "Zľavový kód dostupný"}
                    </div>
                  )}
                  {shopOffers.deal && (
                    <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>
                      🔥 <strong>Akcia:</strong> {shopOffers.deal.title || "Prebiehajúca akcia"}
                    </div>
                  )}
                </div>
                {shopSlug && (
                  <a
                    href={`/kupony/${shopSlug}`}
                    style={{ fontSize: 13, color: "#16A34A", fontWeight: 700, textDecoration: "none" }}
                  >
                    Zobraziť kupóny obchodu →
                  </a>
                )}
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 8 }}>
                  Kupón nemusí platiť na tento konkrétny produkt.
                </div>
              </div>
            )}

            {/* CTA — vždy tá istá ponuka, ktorú odporúča box vyššie */}
            <TrackedLink
              href={buyUrl}
              target="_blank"
              rel="nofollow noopener noreferrer"
              type={ctaIsHeureka ? "heureka_fallback" : "product_outbound"}
              shopSlug={recommendedShopSlug || shopSlug}
              productSlug={slug}
              destinationDomain={ctaIsHeureka ? "www.heureka.sk" : recommendedDomain}
              style={{
                display: "inline-flex", alignItems: "center", gap: 10,
                padding: "16px 32px", borderRadius: 14,
                background: "#22C55E", color: "#fff",
                fontWeight: 800, fontSize: 16, textDecoration: "none",
                boxShadow: "0 4px 18px rgba(34,197,94,0.30)",
              }}
            >
              {ctaIsHeureka
                ? "Zobraziť ponuky na Heureke →"
                : bestPurchase?.isLowestVerified
                  ? "Prejsť na najvýhodnejšiu ponuku →"
                  : `Kúpiť na ${recommendedDomain} →`}
            </TrackedLink>

            <p style={{ fontSize: 11, color: "#bbb", marginTop: 10, margin: "10px 0 0" }}>
              {isMonetized ? "Partnerský odkaz · " : ""}Cena overená pri poslednom importe XML feeda
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
                const rPrice = formatProductPriceLines(p);
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
                      <div style={{ color: "#22C55E", lineHeight: 1.2 }}>
                        <div style={{ fontSize: 14, fontWeight: 800 }}>{rPrice.primary}</div>
                        {rPrice.secondary && (
                          <div title="Orientačný prepočet podľa aktuálne nastaveného kurzu." style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                            {rPrice.secondary}
                          </div>
                        )}
                      </div>
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
