import { cache } from "react";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { collectShopOffers, loadShopOfferSources, type ShopOfferSources } from "@/lib/dognet";
import { getShopDescription } from "@/lib/shop-desc";
import { findAffialShop } from "@/lib/affial-shops";
import AdBanner from "@/components/AdBanner";
import TopCodes from "@/components/TopCodes";
import ShopCouponList from "@/components/ShopCouponList";
import ShopFavicon from "@/components/ShopFavicon";
import { getShopDomain } from "@/lib/shop-domains";
import { withTimeout } from "@/lib/with-timeout";
import { isAdultShop, resolveCategory } from "@/lib/shop-categories";
import { TAXONOMY, TAXONOMY_LIST } from "@/lib/taxonomy";
import { compareShopsByPriority } from "@/lib/shop-priority";
import { affiliateUrlFromCoupons, getShopAffiliateUrl, hasDirectLink } from "@/lib/shop-affiliate";
import { getAllArticles, type Article } from "@/lib/articles";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import TrackedLink from "@/components/TrackedLink";
import Breadcrumbs from "@/components/Breadcrumbs";
import { absoluteUrl, clampDescription, plural } from "@/lib/seo/config";
import { fitTitle, metadataTitle, shopTitleVariants } from "@/lib/seo/title";
import { breadcrumbJsonLd, buildJsonLdGraph, itemListJsonLd, type Crumb } from "@/lib/seo/jsonld";
import { SHOP_NAME_OVERRIDES, TOP_SLUGS, getShopRegistry, resolveShopRequest } from "@/lib/seo/shop-registry";
import { isShopOfferActive, shopIndexDecision } from "@/lib/seo/indexing";
import { articlesByShop, getShopSeoIndex, shopLookupName } from "@/lib/seo/shop-index";

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 3600;
export const dynamic = "force-dynamic";

/**
 * Dáta stránky obchodu — zdieľané medzi generateMetadata a renderom
 * (React cache = jeden fetch na request). Rozhodnutie o existencii/redirecte
 * robí centrálny register (lib/seo/shop-registry.ts).
 */
const loadShop = cache(async (rawSlug: string) => {
  // Zdroje nezávislé od slugu sa začnú načítavať HNEĎ, paralelne s resolve (predtým sériovo).
  const sourcesP = withTimeout<ShopOfferSources | null>(loadShopOfferSources(), 8000, null);
  const articlesP = withTimeout(getAllArticles(), 3000, [] as Article[]);
  const seoIndexP = withTimeout(getShopSeoIndex(), 2500, [] as Awaited<ReturnType<typeof getShopSeoIndex>>);
  const res = await resolveShopRequest(rawSlug);
  if (res.kind === "notfound") notFound();
  if (res.kind === "redirect") permanentRedirect(res.to);

  const { baseSlug, isCzVariant, entry } = res;
  const affialShop = findAffialShop(res.slug) ?? findAffialShop(baseSlug);
  // `capitalized` = kľúč pre dátové lookupy (doména, affiliate URL, TopCodes) — nemeniť formu.
  const slugName = shopLookupName(baseSlug);
  const capitalized =
    affialShop?.name ??
    SHOP_NAME_OVERRIDES[baseSlug] ??
    (slugName.charAt(0).toUpperCase() + slugName.slice(1));
  // `displayName` = čitateľné meno pre title/H1/breadcrumbs (z registra, vyčistené).
  const displayName = SHOP_NAME_OVERRIDES[baseSlug] ?? entry.name ?? capitalized;

  // Timeouty na render-path volania — viď [[with-timeout]].
  const [sources, reg, allArticles, seoIndex] = await Promise.all([sourcesP, getShopRegistry(), articlesP, seoIndexP]);
  // = getCouponsByShop(slugName), len nad už načítanými zdrojmi (rovnaká funkcia collectShopOffers).
  const liveCoupons: any[] | null = sources ? collectShopOffers(slugName, sources) : null;
  const coupons = liveCoupons ?? [];
  const articles = (articlesByShop(allArticles, reg).get(baseSlug) ?? [])
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);

  // Expirované ponuky sa nezobrazujú ako aktívne (kanonický freshness model).
  const active = coupons.filter(isShopOfferActive);
  const codeCount = active.filter((c: any) => c.code && String(c.code).trim() !== "").length;
  const dealCount = active.length - codeCount;
  const isAdult = isAdultShop({ slug: baseSlug, name: displayName, domain: entry.domain });
  // Jeden zdroj pravdy pre index/noindex: SEO index (ten istý rozhoduje o sitemap) →
  // meta robots a sitemap sa nemôžu rozísť. Živý výpočet len keď index nie je dostupný,
  // a vtedy fail-open (timeout zdroja nikdy nespôsobí noindex).
  const indexed = seoIndex.find((st) => st.slug === baseSlug);
  let decision = isCzVariant
    ? shopIndexDecision({ slug: baseSlug, activeOffers: 0, isCzVariant })
    : indexed
    ? { index: indexed.index, reason: `SEO index: ${indexed.reason}` }
    : shopIndexDecision({ slug: baseSlug, activeOffers: active.length + articles.length, isAdult });
  if (!indexed && !decision.index && !isCzVariant && !isAdult && liveCoupons === null) {
    decision = { index: true, reason: "zdroj ponúk neodpovedal (fail-open)" };
  }

  return { slug: res.slug, baseSlug, isCzVariant, affialShop, capitalized, displayName, entry, coupons, articles, codeCount, dealCount, decision };
});

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
      a: `Podmienky dopravy sa v obchode ${shopName} môžu meniť a niekedy ich pokrýva akcia alebo kupón na dopravu. Aktuálne podmienky dopravy si over priamo na webe obchodu.`,
    },
    {
      q: `Kde nájdem aktuálne ${shopName} kupóny?`,
      a: `Aktuálne zľavové kódy a akcie pre ${shopName} nájdete tu na Zlavickovo.sk. Ponuky čerpáme z affiliate sietí obchodu a pravidelne ich aktualizujeme; platnosť kódu si vždy over v pokladni obchodu.`,
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
 * Súvisiace obchody z rovnakej kategórie — prednostne indexovateľné obchody
 * s aktívnymi ponukami (SEO index), aby interné odkazy viedli na hodnotné stránky.
 * Fallback na kurátorské TOP_SLUGS, keď kategória chýba alebo má málo obchodov.
 */
async function getRelatedShops(
  currentSlug: string,
  categoryId: ReturnType<typeof resolveCategory>,
  count = 4,
): Promise<{ slug: string; name: string }[]> {
  const reg = await getShopRegistry();
  const nameOf = (slug: string) => reg.bySlug.get(slug)?.name ?? slug.replace(/-/g, " ");
  const out: { slug: string; name: string }[] = [];
  const seen = new Set([currentSlug]);
  if (categoryId) {
    const index = await getShopSeoIndex().catch(() => []);
    const offers = (s: (typeof index)[number]) => s.activeCodes + s.activeDeals + s.activeArticles;
    const sameCat = index
      .filter(s => s.categoryId === categoryId && s.index && !seen.has(s.slug))
      .sort((a, b) => offers(b) - offers(a) || a.slug.localeCompare(b.slug))
      .slice(0, count);
    for (const s of sameCat) { out.push({ slug: s.slug, name: s.name }); seen.add(s.slug); }
  }
  for (const slug of getRelatedShopsFallback(currentSlug, count + 2)) {
    if (out.length >= count) break;
    if (seen.has(slug) || !reg.bySlug.has(slug)) continue;
    out.push({ slug, name: nameOf(slug) });
    seen.add(slug);
  }
  return out;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const d = await loadShop(slug);
  const { month, year } = currentMonthYear();
  const name = d.displayName;
  const canonicalUrl = absoluteUrl(`/kupony/${d.baseSlug}`);
  const categoryId = resolveCategory({ slug: d.baseSlug, name: d.capitalized, domain: getShopDomain(d.capitalized) || d.entry.domain || `${d.baseSlug}.sk` });
  const categoryLabel = categoryId ? TAXONOMY[categoryId].label.toLowerCase() : null;
  const dealTotal = d.dealCount + d.articles.length;

  // Search intent: "{obchod} zľavový kód" / "{obchod} akcie" — meno obchodu vpredu.
  const title = fitTitle(shopTitleVariants(name, d.codeCount > 0, month, year));

  const codes = `${d.codeCount} ${plural(d.codeCount, "zľavový kód", "zľavové kódy", "zľavových kódov")}`;
  const deals = `${dealTotal} ${plural(dealTotal, "aktuálna akcia", "aktuálne akcie", "aktuálnych akcií")}`;
  let description: string;
  if (d.codeCount > 0 && dealTotal > 0) {
    description = `${name}: ${codes} a ${deals} na ${month} ${year}. Kód odhalíš jedným klikom, platnosť a podmienky si over v pokladni obchodu.`;
  } else if (d.codeCount > 0) {
    description = `Aktuálne ${name} zľavové kódy – ${codes} na ${month} ${year}. Kód odhalíš jedným klikom, platnosť si over v pokladni obchodu.`;
  } else if (dealTotal > 0) {
    description = `${name}: ${deals} na ${month} ${year} zo zapojených affiliate sietí. Pozri podmienky akcie a prejdi priamo do obchodu.`;
  } else {
    description = `Zľavové kódy a akcie pre ${name}. Momentálne nemáme aktívnu ponuku – pozri podobné obchody${categoryLabel ? ` v kategórii ${categoryLabel}` : ""} s aktuálnymi zľavami.`;
  }

  return {
    title: metadataTitle(title),
    description: clampDescription(description),
    alternates: { canonical: canonicalUrl },
    robots: d.decision.index ? undefined : { index: false, follow: true },
    openGraph: {
      title: `${name} zľavové kódy a akcie – ${month} ${year}`,
      description: clampDescription(description),
      url: canonicalUrl, type: "website", locale: "sk_SK",
    },
  };
}

export default async function ShopPage({ params }: Props) {
  const { slug } = await params;
  const d = await loadShop(slug);
  const { baseSlug, affialShop, capitalized, displayName, articles } = d;
  const isCz = d.isCzVariant;
  const { month, year } = currentMonthYear();
  const faq = getFAQ(displayName);
  let coupons: any[] = d.coupons;

  // Shop visit URL — priorita: affiliate z kupónov (Dognet → eHub → Affial) → Affial partner → eHub kampaň → priama doména
  const shopDomain = getShopDomain(capitalized) || d.entry.domain || `${baseSlug}.sk`;
  // Kategória obchodu — pre popis, súvisiace obchody a podobné kategórie.
  const categoryId = resolveCategory({ slug: baseSlug, name: capitalized, domain: shopDomain });
  const categoryLabel = categoryId ? TAXONOMY[categoryId].label : null;
  // Related shops fallback (bez siete) pre prípad timeoutu
  const relatedFallback = getRelatedShopsFallback(baseSlug, 4).map(s => {
    const n = s.replace(/-/g, " ");
    return { slug: s, name: n.charAt(0).toUpperCase() + n.slice(1) };
  });

  // Tri nezávislé volania paralelne (predtým sériovo: affiliate URL → popis z DB → súvisiace obchody).
  const directAffiliate = affiliateUrlFromCoupons(coupons) ?? affialShop?.affiliateUrl ?? null;
  const [fallbackAffiliate, shopDesc, relatedShops] = await Promise.all([
    directAffiliate ? Promise.resolve(null) : withTimeout(getShopAffiliateUrl(capitalized), 4000, null),
    withTimeout(getShopDescription(capitalized, baseSlug), 3000, { short: "", long: "", source: "fallback" as const }),
    withTimeout(getRelatedShops(baseSlug, categoryId, 4), 3000, relatedFallback),
  ]);
  const shopAffiliateUrl: string | null = directAffiliate ?? fallbackAffiliate;
  const shopVisitUrl: string = shopAffiliateUrl ?? `https://${shopDomain}`;

  // Priame odkazy bez trackingu (statické akcie, fallbacky) nahradí affiliate URL, ak existuje
  if (shopAffiliateUrl) {
    coupons = coupons.map((c: any) =>
      hasDirectLink(c) ? { ...c, url: shopAffiliateUrl, affiliate_link: shopAffiliateUrl } : c
    );
  }

  // Expirované ponuky sa nezobrazujú ako aktívne (kanonický freshness model).
  const activeCoupons = coupons.filter(isShopOfferActive);

  const rawCodeCoupons = activeCoupons.filter((c: any) => c.code && c.code.trim() !== "");
  const dealCoupons = activeCoupons.filter((c: any) => !c.code || c.code.trim() === "");

  const codeCoupons = rawCodeCoupons.map(c => {
    const { code, ...rest } = c;
    return { ...rest, _token: Buffer.from(`${capitalized}:${code}`).toString("base64") };
  });

  const similarCategories = TAXONOMY_LIST.filter(c => c.id !== categoryId).slice(0, 6);

  const crumbs: Crumb[] = [
    { name: "Domov", path: "/" },
    { name: "Obchody", path: "/obchody" },
    { name: displayName, path: `/kupony/${baseSlug}` },
  ];
  const jsonLd = buildJsonLdGraph([
    breadcrumbJsonLd(crumbs),
    itemListJsonLd(`Aktuálne akcie ${displayName}`, articles.map(a => ({ name: a.title, path: `/akcie/${a.slug}` }))),
  ]);

  return (
    <div data-active-offers={activeCoupons.length + articles.length} style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", minHeight: "100vh", background: "#F8FAFC", color: "#111827" }}>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />}

      <Nav />

      {/* Breadcrumb */}
      <div style={{ background: "#fff", borderBottom: "1px solid #F3F4F6" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "10px 24px" }}>
          <Breadcrumbs items={crumbs} color="#6B7280" />
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
              <ShopFavicon domain={shopDomain} name={displayName} size={52} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ fontSize: "clamp(18px, 3vw, 26px)", fontWeight: 800, margin: "0 0 12px", color: "#111827", letterSpacing: "-0.5px", lineHeight: 1.25 }}>
                {displayName} zľavové kódy a akcie – {month} {year}{isCz ? " (CZ)" : ""}
              </h1>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 12, background: "#DCFCE7", color: "#15803D", fontWeight: 700, padding: "4px 12px", borderRadius: 9999 }}>
                  {codeCoupons.length} zľavových kódov
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
            {/* Kategória obchodu (popis je v hlavičke a v sekcii „O obchode") */}
            {categoryLabel && (
              <div className="card-section">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  <a href={`/kategoria/${categoryId}`} style={{ textDecoration: "none" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, background: "#DCFCE7", color: "#15803D", padding: "5px 12px", borderRadius: 9999 }}>
                      {TAXONOMY[categoryId!].emoji} {categoryLabel}
                    </span>
                  </a>
                </div>
              </div>
            )}

            <div style={{ marginBottom: 16, display: "flex", justifyContent: "center" }}>
              <AdBanner slot="header" shopName={capitalized} />
            </div>

            {/* Sekcia 2 — Zľavové kódy (len s kódom) */}
            <div className="card-section">
              <h2 className="section-title">🏷️ {displayName} zľavové kódy ({codeCoupons.length})</h2>
              <ShopCouponList capitalized={capitalized} coupons={codeCoupons} kind="kupony" shopUrl={shopVisitUrl} />
            </div>

            {/* Sekcia 3 — Akcie a zľavy (bez kódu) */}
            <div className="card-section">
              <h2 className="section-title">🔥 Akcie a zľavy ({dealCoupons.length})</h2>
              <ShopCouponList capitalized={capitalized} coupons={dealCoupons} kind="akcie" shopUrl={shopVisitUrl} />
            </div>

            {/* Sekcia 4 — Akcie obchodu s vlastnou stránkou (interné prelinkovanie obchod → ponuky) */}
            {articles.length > 0 && (
              <div className="card-section">
                <h2 className="section-title">📰 Aktuálne akcie {displayName}</h2>
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                  {articles.map(a => (
                    <li key={a.slug} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", borderBottom: "1px solid #F3F4F6", paddingBottom: 10 }}>
                      <a href={`/akcie/${a.slug}`} style={{ color: "#111827", fontWeight: 600, fontSize: 14, textDecoration: "none", lineHeight: 1.45 }}>{a.title}</a>
                      {a.validTo && (
                        <span style={{ fontSize: 12, color: "#6B7280", whiteSpace: "nowrap" }}>do {new Date(a.validTo).toLocaleDateString("sk-SK")}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Sekcia 5 — O obchode (SEO popis, fallback ak chýba) */}
            {shopDesc.long && (
              <div className="card-section">
                <h2 className="section-title">ℹ️ O obchode {displayName}</h2>
                {shopDesc.long.split(/\n{2,}/).map((para, i) => (
                  <p key={i} style={{ fontSize: 14, color: "#374151", lineHeight: 1.75, margin: i === 0 ? "0 0 12px" : "0 0 12px" }}>
                    {para.trim()}
                  </p>
                ))}
              </div>
            )}

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
                  Prejsť do obchodu
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
            Časté otázky – {displayName} kupóny
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
