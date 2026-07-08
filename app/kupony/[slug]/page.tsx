import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getCouponsByShop } from "@/lib/dognet";
import { getShopDescription } from "@/lib/shop-desc";
import { findAffialShop } from "@/lib/affial-shops";
import { getAllKnownShops, getStaticKnownShops, type KnownShop } from "@/lib/all-shops";
import AiCoupons from "@/components/AiCoupons";
import AdBanner from "@/components/AdBanner";
import TopCodes from "@/components/TopCodes";
import HeurekaWidget from "@/components/HeurekaWidget";
import ShopCouponList from "@/components/ShopCouponList";
import ShopPriceDrops from "@/components/ShopPriceDrops";
import ShopProducts from "@/components/ShopProducts";
import ShopFavicon from "@/components/ShopFavicon";
import { getShopDomain } from "@/lib/shop-domains";
import { getBiggestPriceDropsByDomain } from "@/lib/heureka/price-history";
import { getShopProducts, getProductsByCategory } from "@/lib/heureka/query";
import { resolveCategory } from "@/lib/shop-categories";
import { TAXONOMY, TAXONOMY_LIST } from "@/lib/taxonomy";
import { compareShopsByPriority } from "@/lib/shop-priority";
import { affiliateUrlFromCoupons, getShopAffiliateUrl, hasDirectLink } from "@/lib/shop-affiliate";
// ShopLogo removed — using ShopFavicon throughout
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import TrackedLink from "@/components/TrackedLink";

type Props = { params: Promise<{ slug: string }> };

const BASE = "https://www.zlavickovo.sk";

export const revalidate = 3600;

// Správne obchodné meno pre slugy, ktoré nie sú v žiadnom feede
// a kapitalizácia zo slugu by vyrobila nezmysel ("Czc" namiesto "CZC.cz")
const SHOP_NAME_OVERRIDES: Record<string, string> = {
  czc: "CZC.cz",
};

const TOP_SLUGS = [
  "alza","shein","zalando","mall","notino","sportisimo",
  "ikea","dedoles","martinus","about-you","answear","dr-max",
  "zara","h-m","asos","lidl","kaufland","decathlon","nike","adidas",
];

export async function generateStaticParams() {
  // ZÁMERNE prázdne — shop stránky sa negenerujú pri builde, ale on-demand cez ISR
  // (revalidate = 3600, dynamicParams default true).
  //
  // Dôvod: v build prostredí Vercelu nie je dostupný Redis (Error: ENVIRONMENT_FALLBACK),
  // takže prerender každej shop stránky ide naživo (AI search, CJ, joined-campaigns)
  // a prekračuje 60 s limit → build padal. Za behu Redis funguje, ISR vygeneruje
  // a nacachuje stránku pri prvom requeste (rovnako indexovateľné pre SEO).
  //
  // Sitemap (app/sitemap.ts) naďalej vymenúva všetky shop URL — indexácia zostáva.
  return [];
}

/**
 * Soft 404 guard — stránka existuje len pre slug známeho obchodu.
 * Validné tvary: kanonický slug z getAllKnownShops(), kurátorské TOP_SLUGS
 * a SHOP_NAME_OVERRIDES, Affial partneri, plus "-cz" mutácia každého z nich
 * (generateMetadata inzeruje cs hreflang `${slug}-cz` pre každú SK stránku).
 */
async function isValidShopSlug(slug: string): Promise<boolean> {
  const baseSlug = slug.endsWith("-cz") ? slug.slice(0, -3) : slug;
  if (!baseSlug) return false;

  if (TOP_SLUGS.includes(baseSlug)) return true;
  if (SHOP_NAME_OVERRIDES[baseSlug]) return true;
  if (findAffialShop(slug) || findAffialShop(baseSlug)) return true;

  let shops: KnownShop[];
  try { shops = await getAllKnownShops(); } catch { shops = getStaticKnownShops(); }
  return shops.some(s => s.slug === baseSlug || s.slug === slug);
}

function currentMonthYear() {
  const now = new Date();
  const month = new Intl.DateTimeFormat("sk-SK", { month: "long" }).format(now);
  return { month, year: now.getFullYear() };
}

function getFAQ(shopName: string) {
  return [
    {
      q: `Ako použiť ${shopName} zľavový kód?`,
      a: `Pridajte produkty do košíka na webe ${shopName}. V pokladni nájdite pole "Zľavový kód" alebo "Promo kód", zadajte kód a kliknite na použiť. Zľava sa automaticky odpočíta z celkovej sumy.`,
    },
    {
      q: `Má ${shopName} dopravu zadarmo?`,
      a: `${shopName} ponúka dopravu zadarmo pri nákupe nad určitú minimálnu sumu alebo pri použití špeciálneho kupónu na dopravu. Skontrolujte aktuálne podmienky priamo na webe obchodu.`,
    },
    {
      q: `Kde nájdem aktuálne ${shopName} kupóny?`,
      a: `Aktuálne overené kupóny pre ${shopName} nájdete práve tu na Zlavickovo.sk. Naše AI automaticky vyhľadáva a overuje kódy z viacerých zdrojov a pravidelne ich aktualizuje.`,
    },
  ];
}

function getRelatedShopsFallback(currentSlug: string, count = 4) {
  const others = TOP_SLUGS.filter(s => s !== currentSlug);
  const seed = currentSlug.charCodeAt(0) + currentSlug.length;
  const start = seed % Math.max(1, others.length - count);
  // .sk → .cz → ostatné, v rámci priority abecedne
  return others.slice(start, start + count).sort((a, b) => {
    const nameA = a.replace(/-/g, " ");
    const nameB = b.replace(/-/g, " ");
    return compareShopsByPriority({ name: nameA }, { name: nameB });
  });
}

/**
 * Súvisiace obchody z rovnakej kategórie (existujúce dáta getAllKnownShops).
 * Fallback na kurátorské TOP_SLUGS, keď kategória chýba alebo má málo obchodov.
 */
async function getRelatedShops(
  currentSlug: string,
  categoryId: ReturnType<typeof resolveCategory>,
  count = 4,
): Promise<{ slug: string; name: string }[]> {
  if (categoryId) {
    try {
      const shops = await getAllKnownShops();
      const sameCat = shops
        .filter(s => s.categoryId === categoryId && s.slug && s.slug !== currentSlug)
        .sort(compareShopsByPriority)
        .slice(0, count)
        .map(s => ({ slug: s.slug, name: s.name }));
      if (sameCat.length >= count) return sameCat;
      // doplň fallbackom, bez duplicít
      const seen = new Set([currentSlug, ...sameCat.map(s => s.slug)]);
      for (const slug of getRelatedShopsFallback(currentSlug, count)) {
        if (sameCat.length >= count) break;
        if (seen.has(slug)) continue;
        const n = slug.replace(/-/g, " ");
        sameCat.push({ slug, name: n.charAt(0).toUpperCase() + n.slice(1) });
        seen.add(slug);
      }
      if (sameCat.length > 0) return sameCat;
    } catch {}
  }
  return getRelatedShopsFallback(currentSlug, count).map(slug => {
    const n = slug.replace(/-/g, " ");
    return { slug, name: n.charAt(0).toUpperCase() + n.slice(1) };
  });
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  if (!(await isValidShopSlug(slug))) notFound();
  const isCz = slug.endsWith("-cz");
  const baseSlug = isCz ? slug.slice(0, -3) : slug;
  const name = baseSlug.replace(/-/g, " ");
  const shopName = SHOP_NAME_OVERRIDES[baseSlug] ?? (name.charAt(0).toUpperCase() + name.slice(1));
  const { month, year } = currentMonthYear();
  const pageUrl = `${BASE}/kupony/${slug}`;

  return {
    title: `${shopName} kupóny a zľavy ${year} | Zlavickovo.sk`,
    description: `Aktuálne overené kupóny pre ${shopName}. Ušetri na nákupe.`,
    alternates: {
      canonical: pageUrl,
      languages: isCz ? undefined : { sk: pageUrl, cs: `${BASE}/kupony/${slug}-cz` },
    },
    openGraph: {
      title: `${shopName} zľavové kódy ${year} | Zlavickovo.sk`,
      description: `Aktuálne overené kupóny pre ${shopName}. Ušetri na nákupe.`,
      url: pageUrl, type: "website", locale: "sk_SK",
    },
  };
}

export default async function ShopPage({ params }: Props) {
  const { slug } = await params;
  if (!(await isValidShopSlug(slug))) notFound();
  const isCz = slug.endsWith("-cz");
  const baseSlug = isCz ? slug.slice(0, -3) : slug;
  const shopName = baseSlug.replace(/-/g, " ");
  const affialShop = findAffialShop(slug);
  const capitalized =
    affialShop?.name ??
    SHOP_NAME_OVERRIDES[baseSlug] ??
    (shopName.charAt(0).toUpperCase() + shopName.slice(1));
  const { month, year } = currentMonthYear();
  const pageUrl = `${BASE}/kupony/${slug}`;
  const faq = getFAQ(capitalized);

  let coupons: any[] = [];
  try { coupons = await getCouponsByShop(shopName); } catch {}

  // Shop visit URL — priorita: affiliate z kupónov (Dognet → eHub → Affial) → Affial partner → eHub kampaň → priama doména
  const shopDomain = getShopDomain(capitalized) || `${baseSlug}.sk`;
  const shopAffiliateUrl: string | null =
    affiliateUrlFromCoupons(coupons) ??
    affialShop?.affiliateUrl ??
    (await getShopAffiliateUrl(capitalized).catch(() => null));
  const shopVisitUrl: string = shopAffiliateUrl ?? `https://${shopDomain}`;

  // Priame odkazy bez trackingu (statické akcie, fallbacky) nahradí affiliate URL, ak existuje
  if (shopAffiliateUrl) {
    coupons = coupons.map((c: any) =>
      hasDirectLink(c) ? { ...c, url: shopAffiliateUrl, affiliate_link: shopAffiliateUrl } : c
    );
  }

  const rawCodeCoupons = coupons.filter((c: any) => c.code && c.code.trim() !== "");
  const dealCoupons = coupons.filter((c: any) => !c.code || c.code.trim() === "");

  const codeCoupons = rawCodeCoupons.map(c => {
    const { code, ...rest } = c;
    return { ...rest, _token: Buffer.from(`${capitalized}:${code}`).toString("base64") };
  });

  let shopDesc: { short: string; long: string } = { short: "", long: "" };
  try { shopDesc = await getShopDescription(capitalized, baseSlug); } catch {}

  // Sekcia 4 — najväčší pokles ceny. Prázdne, kým sa nenapĺňa history (Vlna 2) →
  // ShopPriceDrops sa nezobrazí. Doména z názvu, fallback na slug.
  let priceDrops: Awaited<ReturnType<typeof getBiggestPriceDropsByDomain>> = [];
  try { priceDrops = await getBiggestPriceDropsByDomain(shopDomain, 6); } catch {}

  const hasCodeCoupon = codeCoupons.length > 0;

  // Kategória obchodu (existujúce dáta, bez siete) — pre SEO blok, produkty, related shops a podobné kategórie
  const categoryId = resolveCategory({ slug: baseSlug, name: capitalized, domain: shopDomain });
  const categoryLabel = categoryId ? TAXONOMY[categoryId].label : null;

  // Produkty: 1. vlastné (podľa domény). 2. fallback podľa kategórie (odporúčané z podobných obchodov).
  // "ine"/null kategória → žiadny fallback (grab-bag). Prázdne → sekcia sa nezobrazí.
  let shopProducts: Awaited<ReturnType<typeof getShopProducts>> = [];
  try { shopProducts = await getShopProducts(shopDomain, 12); } catch {}
  let fallbackProducts: Awaited<ReturnType<typeof getProductsByCategory>> = [];
  if (shopProducts.length === 0 && categoryId && categoryId !== "ine") {
    try { fallbackProducts = await getProductsByCategory(categoryId, 12); } catch {}
  }
  const productTypes = [...new Set(shopProducts.map(p => p.category).filter(Boolean))].slice(0, 4);
  const relatedShops = await getRelatedShops(baseSlug, categoryId, 4);
  const similarCategories = TAXONOMY_LIST.filter(c => c.id !== categoryId).slice(0, 6);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Domov", "item": BASE },
          { "@type": "ListItem", "position": 2, "name": "Obchody", "item": `${BASE}/obchody` },
          { "@type": "ListItem", "position": 3, "name": capitalized, "item": pageUrl },
        ],
      },
      {
        "@type": "FAQPage",
        "mainEntity": faq.map(f => ({
          "@type": "Question", "name": f.q,
          "acceptedAnswer": { "@type": "Answer", "text": f.a },
        })),
      },
    ],
  };

  return (
    <div style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", minHeight: "100vh", background: "#F8FAFC", color: "#111827" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Nav />

      {/* Breadcrumb */}
      <div style={{ background: "#fff", borderBottom: "1px solid #F3F4F6" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "10px 24px", fontSize: 12, color: "#9CA3AF", display: "flex", alignItems: "center", gap: 4 }}>
          <a href="/" style={{ color: "#9CA3AF", textDecoration: "none" }}>Zlavickovo</a>
          <span>›</span>
          <a href="/obchody" style={{ color: "#9CA3AF", textDecoration: "none" }}>Kupóny</a>
          <span>›</span>
          <span style={{ color: "#374151", fontWeight: 600 }}>{capitalized}</span>
        </div>
      </div>

      {/* Shop header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #F3F4F6", padding: "28px 24px 26px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 20 }}>
            {/* Favicon in framed box */}
            <div style={{
              width: 76, height: 76, borderRadius: 18, flexShrink: 0,
              background: "#F8FAFC", border: "1.5px solid #E5E7EB",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}>
              <ShopFavicon domain={getShopDomain(capitalized) || `${baseSlug}.sk`} name={capitalized} size={52} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ fontSize: "clamp(18px, 3vw, 26px)", fontWeight: 800, margin: "0 0 12px", color: "#111827", letterSpacing: "-0.5px", lineHeight: 1.25 }}>
                {capitalized} zľavové kódy &amp; kupóny {month} {year}{isCz ? " (CZ)" : ""}
              </h1>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 12, background: "#DCFCE7", color: "#15803D", fontWeight: 700, padding: "4px 12px", borderRadius: 9999 }}>
                  ✓ {codeCoupons.length} overených kupónov
                </span>
                {dealCoupons.length > 0 && (
                  <span style={{ fontSize: 12, background: "#FFF7ED", color: "#C2410C", fontWeight: 700, padding: "4px 12px", borderRadius: 9999 }}>
                    🔥 {dealCoupons.length} akcií
                  </span>
                )}
                <span style={{ fontSize: 12, background: "#F1F5F9", color: "#475569", fontWeight: 600, padding: "4px 12px", borderRadius: 9999 }}>
                  Aktualizované: {month} {year}
                </span>
                {isCz && (
                  <span style={{ fontSize: 12, background: "#DBEAFE", color: "#1D4ED8", fontWeight: 600, padding: "4px 12px", borderRadius: 9999 }}>CZ</span>
                )}
              </div>
              {shopDesc.short && (
                <p style={{ fontSize: 13, color: "#6B7280", margin: "12px 0 0", lineHeight: 1.65, maxWidth: 640 }}>
                  {shopDesc.short.length > 220 ? shopDesc.short.slice(0, 220) + "…" : shopDesc.short}
                </p>
              )}
              <TrackedLink
                href={shopVisitUrl}
                target="_blank"
                rel="nofollow noopener noreferrer"
                type="shop_outbound"
                shopSlug={baseSlug}
                destinationDomain={shopDomain}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  marginTop: 16, padding: "12px 24px", borderRadius: 12,
                  background: "#22C55E", color: "#fff",
                  fontWeight: 700, fontSize: 15, textDecoration: "none",
                  boxShadow: "0 4px 14px rgba(34,197,94,0.30)",
                  transition: "background 0.15s",
                }}
              >
                Prejsť do {capitalized} →
              </TrackedLink>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media(max-width:768px){
          .shop-layout { flex-direction: column !important; }
          .shop-sidebar { display: none !important; }
          .shop-sidebar-mobile { display: block !important; }
          .related-grid { grid-template-columns: repeat(2,1fr) !important; }
        }
        .card-section { background: #fff; border-radius: 16px; border: 1px solid #E5E7EB; padding: 24px; margin-bottom: 16px; box-shadow: 0 1px 4px rgba(0,0,0,0.05); }
        .section-title { font-size: 16px; font-weight: 700; color: #111827; margin: 0 0 18px; display: flex; align-items: center; gap: 8px; }
      `}</style>

      {/* Main layout */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 24px 48px" }}>
        <div className="shop-layout" style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>

          {/* Left column */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* SEO blok pod hero — popis, kategória, typ produktov */}
            {(shopDesc.short || categoryLabel) && (
              <div className="card-section">
                {shopDesc.short && (
                  <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.7, margin: "0 0 12px" }}>
                    {shopDesc.short}
                  </p>
                )}
                {(categoryLabel || productTypes.length > 0) && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                    {categoryLabel && (
                      <a href={`/kategoria/${categoryId}`} style={{ textDecoration: "none" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, background: "#DCFCE7", color: "#15803D", padding: "5px 12px", borderRadius: 9999 }}>
                          {TAXONOMY[categoryId!].emoji} {categoryLabel}
                        </span>
                      </a>
                    )}
                    {productTypes.map(pt => (
                      <span key={pt} style={{ fontSize: 12, fontWeight: 600, background: "#F1F5F9", color: "#475569", padding: "5px 12px", borderRadius: 9999 }}>
                        {pt}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={{ marginBottom: 16, display: "flex", justifyContent: "center" }}>
              <AdBanner slot="header" shopName={capitalized} />
            </div>

            {/* Sekcia 2 — Overené kupóny (len s kódom) */}
            <div className="card-section">
              <div className="section-title">🏷️ Overené kupóny ({codeCoupons.length})</div>
              <ShopCouponList capitalized={capitalized} coupons={codeCoupons} kind="kupony" shopUrl={shopVisitUrl} />
            </div>

            {/* Sekcia 3 — Akcie a zľavy (bez kódu) */}
            <div className="card-section">
              <div className="section-title">🔥 Akcie a zľavy ({dealCoupons.length})</div>
              <ShopCouponList capitalized={capitalized} coupons={dealCoupons} kind="akcie" shopUrl={shopVisitUrl} />
            </div>

            {/* Sekcia 4 — Najväčší pokles ceny (zobrazí sa len ak existuje história) */}
            <ShopPriceDrops drops={priceDrops} capitalized={capitalized} shopSlug={baseSlug} />

            {/* Produkty z obchodu (vlastné) alebo fallback odporúčaných z podobných obchodov */}
            {shopProducts.length > 0 ? (
              <ShopProducts products={shopProducts} capitalized={capitalized} shopSlug={baseSlug} variant="own" hasCoupon={hasCodeCoupon} />
            ) : (
              <ShopProducts products={fallbackProducts} capitalized={capitalized} shopSlug={baseSlug} variant="fallback" />
            )}

            {/* AI Coupons */}
            <div className="card-section">
              <div className="section-title">🤖 AI vyhľadávanie kupónov</div>
              <Suspense fallback={
                <div style={{ textAlign: "center", padding: "36px 20px" }}>
                  <div style={{ width: 34, height: 34, borderRadius: "50%", margin: "0 auto 12px", border: "3px solid #E5E7EB", borderTopColor: "#22C55E", animation: "spin 0.8s linear infinite" }} />
                  <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>AI hľadá kódy pre {capitalized}…</div>
                  <div style={{ fontSize: 12, marginTop: 4, color: "#9CA3AF" }}>Môže to trvať 10–20 sekúnd</div>
                </div>
              }>
                <AiCoupons shopName={`${capitalized}${isCz ? " CZ" : ""}`} />
              </Suspense>
            </div>

            {/* Sekcia 5 — O obchode (SEO popis, fallback ak chýba) */}
            {shopDesc.long && (
              <div className="card-section">
                <div className="section-title">ℹ️ O obchode {capitalized}</div>
                {shopDesc.long.split(/\n{2,}/).map((para, i) => (
                  <p key={i} style={{ fontSize: 14, color: "#374151", lineHeight: 1.75, margin: i === 0 ? "0 0 12px" : "0 0 12px" }}>
                    {para.trim()}
                  </p>
                ))}
              </div>
            )}

            <HeurekaWidget />

            {/* Mobile sidebar */}
            <div className="shop-sidebar-mobile" style={{ display: "none", marginTop: 16 }}>
              <div className="card-section">
                <TopCodes shopFilter={capitalized} limit={5} title="🔥 Najpoužívanejšie kódy" />
              </div>
            </div>
          </div>

          {/* Sidebar – desktop */}
          <div className="shop-sidebar" style={{ width: 268, flexShrink: 0, position: "sticky", top: 72, display: "flex", flexDirection: "column", gap: 14 }}>
            {affialShop && (
              <div style={{
                background: "#fff", borderRadius: 16, padding: "20px",
                border: "1.5px solid #22C55E",
                boxShadow: "0 4px 16px rgba(34,197,94,0.12)",
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#16A34A", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                  Partnerský obchod
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#111827", marginBottom: 16 }}>{affialShop.name}</div>
                <TrackedLink href={affialShop.affiliateUrl} target="_blank" rel="nofollow noopener noreferrer"
                  type="shop_outbound" shopSlug={baseSlug} destinationDomain={shopDomain}
                  style={{
                    display: "block", padding: "12px", borderRadius: 12,
                    background: "linear-gradient(135deg, #22C55E 0%, #16A34A 100%)",
                    color: "#fff", fontWeight: 700, fontSize: 14,
                    textDecoration: "none", textAlign: "center",
                    boxShadow: "0 4px 14px rgba(34,197,94,0.30)",
                  }}
                >
                  Prejsť do obchodu ↗
                </TrackedLink>
              </div>
            )}
            <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #E5E7EB", padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
              <TopCodes shopFilter={capitalized} limit={5} title="🔥 Najpoužívanejšie kódy" />
            </div>
            <AdBanner slot="sidebar" shopName={capitalized} />
          </div>
        </div>

        {/* FAQ */}
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #E5E7EB", padding: "32px", marginTop: 8, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 24px", letterSpacing: "-0.3px", color: "#111827" }}>
            Časté otázky – {capitalized} kupóny
          </h2>
          <div>
            {faq.map((item, i) => (
              <div key={i} style={{ padding: "18px 0", borderBottom: i < faq.length - 1 ? "1px solid #F3F4F6" : "none" }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#111827", marginBottom: 7 }}>{item.q}</div>
                <div style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.65 }}>{item.a}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Related shops — z rovnakej kategórie (fallback TOP_SLUGS) */}
        <div style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px", color: "#1d1d1f" }}>
            Súvisiace obchody{categoryLabel ? ` – ${categoryLabel}` : ""}
          </h2>
          <div className="related-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {relatedShops.map(s => (
              <a key={s.slug} href={`/kupony/${s.slug}`} style={{ textDecoration: "none" }}>
                <div style={{ background: "#fff", borderRadius: 10, padding: "14px 16px", display: "flex", alignItems: "center", gap: 10, border: "1px solid #eaecf0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                  <ShopFavicon domain={getShopDomain(s.name) || `${s.slug}.sk`} name={s.name} size={34} />
                  <span style={{ fontWeight: 600, fontSize: 13, color: "#1d1d1f" }}>{s.name}</span>
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* Podobné kategórie — interné prelinkovanie na /kategoria/[id] */}
        <div style={{ marginTop: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px", color: "#1d1d1f" }}>
            Podobné kategórie
          </h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {similarCategories.map(c => (
              <a key={c.id} href={`/kategoria/${c.id}`} style={{ textDecoration: "none" }}>
                <div style={{ background: c.bg, borderRadius: 9999, padding: "8px 16px", display: "flex", alignItems: "center", gap: 8, border: "1px solid #eaecf0" }}>
                  <span style={{ fontSize: 15 }}>{c.emoji}</span>
                  <span style={{ fontWeight: 700, fontSize: 13, color: c.color }}>{c.label}</span>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
