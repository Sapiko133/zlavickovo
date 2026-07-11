"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import ShopFavicon from "@/components/ShopFavicon";
import CouponTypeBadge from "@/components/CouponTypeBadge";
import { findShop, getCategoryLabel } from "@/lib/search/queryClassifier";
import { normalizeShopSlug } from "@/lib/slug";
import { trackClick } from "@/lib/track-click";
import { buildHeurekaSearchUrl } from "@/lib/heureka/affiliate-url";

type SearchCoupon = {
  code?: string | null;
  title?: string | null;
  shopName?: string | null;
  campaign_name?: string | null;
  affiliate_link?: string | null;
  url?: string | null;
};

type ProductCoupon = {
  code: string;
  link?: string | null;
};

type ProductDeal = {
  link?: string | null;
};

type SearchProduct = {
  name: string;
  url: string;
  domain?: string | null;
  /** Outbound URL vypočítaná serverovo (getOfferOutbound) — klient ju neprepočítava. */
  affiliateUrl?: string | null;
  outboundType?: "shop_affiliate" | "heureka_fallback" | "direct_unmonetized" | null;
  monetized?: boolean | null;
  price?: string | null;
  secondaryPrice?: string | null;
  priceNum?: number | null;
  /** Badge „NAJNIŽŠIA CENA" — server ho priradí len pri dôveryhodnom porovnaní mien. */
  isCheapest?: boolean | null;
  coupon?: ProductCoupon | null;
  deal?: ProductDeal | null;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(code).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      style={{
        padding: "3px 10px", borderRadius: 6,
        border: "1.5px dashed #22C55E",
        background: copied ? "#22C55E" : "#F0FDF4",
        color: copied ? "#fff" : "#16A34A",
        fontWeight: 700, fontSize: 12, cursor: "pointer",
        fontFamily: "monospace", letterSpacing: 1,
      }}
    >
      {copied ? "✓" : code}
    </button>
  );
}

function RevealCode({ code, link }: { code: string; link?: string }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleReveal() {
    if (link) window.open(link, "_blank", "noopener,noreferrer");
    trackClick({ type: "coupon_reveal", couponCode: code || null, destination: link || null });
    setRevealed(true);
    navigator.clipboard.writeText(code).catch(() => {});
  }

  if (!revealed) {
    return (
      <button
        onClick={handleReveal}
        style={{
          padding: "5px 12px", borderRadius: 6,
          border: "1.5px dashed #22C55E",
          background: "#F0FDF4", color: "#16A34A",
          fontWeight: 700, fontSize: 12, cursor: "pointer",
          fontFamily: "monospace", letterSpacing: 1,
        }}
      >
        •••••• Zobraziť kód
      </button>
    );
  }

  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(code).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      style={{
        padding: "3px 10px", borderRadius: 6,
        border: "1.5px dashed #22C55E",
        background: copied ? "#22C55E" : "#F0FDF4",
        color: copied ? "#fff" : "#16A34A",
        fontWeight: 700, fontSize: 12, cursor: "pointer",
        fontFamily: "monospace", letterSpacing: 1,
      }}
    >
      {copied ? "✓ Skopírované" : code}
    </button>
  );
}

// Pod týmto počtom produktov ukážeme aj CTA „Nenašli sme dostatok ponúk"
const MIN_ENOUGH = 4;

function HeurekaCTA({
  q,
  title,
  subtitle,
  heurekaHaffId,
}: {
  q: string;
  title: string;
  subtitle: string;
  heurekaHaffId?: string;
}) {
  const href = buildHeurekaSearchUrl(q, { affiliateId: heurekaHaffId ?? null });

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #F0FDF4 0%, #ecfdf5 100%)",
        border: "1.5px solid #bbf7d0", borderRadius: 16,
        padding: "32px 28px", textAlign: "center",
      }}
    >
      <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
      <div style={{ fontSize: 19, fontWeight: 800, color: "#1d1d1f", marginBottom: 8 }}>{title}</div>
      <p style={{ fontSize: 14, color: "#555", lineHeight: 1.6, margin: "0 auto 20px", maxWidth: 440 }}>
        {subtitle}
      </p>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackClick({ type: "heureka_fallback", destination: href, destinationDomain: "heureka.sk", query: q || null })}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: "14px 28px", borderRadius: 12,
          background: "#22C55E", color: "#fff", fontWeight: 800, fontSize: 15, textDecoration: "none",
          boxShadow: "0 4px 18px rgba(34,197,94,0.30)",
        }}
      >
        Zobraziť ďalšie ponuky na Heureke ↗
      </a>
    </div>
  );
}

function SearchResults({ heurekaHaffId }: { heurekaHaffId?: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const q = params.get("q") ?? "";
  const heurekaSearchHref = buildHeurekaSearchUrl(q, { affiliateId: heurekaHaffId ?? null });
  const [coupons, setCoupons] = useState<SearchCoupon[]>([]);
  const [products, setProducts] = useState<SearchProduct[]>([]);
  const [loadingCoupons, setLoadingCoupons] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  const categoryLabel = q ? getCategoryLabel(q) : null;

  // Kupón = má kód, akcia = bez kódu (musí mať aspoň odkaz)
  const codeCoupons = coupons.filter((c) => c.code && String(c.code).trim() !== "");
  const dealCoupons = coupons.filter((c) => (!c.code || String(c.code).trim() === "") && (c.affiliate_link || c.url));

  // Badge „NAJNIŽŠIA CENA" počíta server (feed-search) s normalizáciou mien —
  // klient neporovnáva surové EUR/CZK čísla.

  // Dopyt = existujúci obchod (getAllKnownShops) → redirect na /kupony/[slug]
  useEffect(() => {
    if (!q) return;
    let cancelled = false;
    findShop(q).then((shop) => {
      if (cancelled || !shop) return;
      setRedirecting(true);
      router.replace(`/kupony/${shop.slug}`);
    });
    return () => { cancelled = true; };
  }, [q, router]);

  useEffect(() => {
    if (!q) return;
    /* eslint-disable react-hooks/set-state-in-effect -- Existing search UX resets loading/results immediately when q changes. */
    setLoadingCoupons(true);
    setLoadingProducts(true);
    setCoupons([]);
    setProducts([]);
    /* eslint-enable react-hooks/set-state-in-effect */

    fetch("/api/search-v2", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q }),
    })
      .then((r) => r.json())
      .then((d: { coupons?: SearchCoupon[] }) => { setCoupons(d?.coupons ?? []); setLoadingCoupons(false); })
      .catch(() => setLoadingCoupons(false));

    fetch(`/api/feed-search?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d: unknown) => { setProducts(Array.isArray(d) ? d as SearchProduct[] : []); setLoadingProducts(false); })
      .catch(() => setLoadingProducts(false));
  }, [q]);

  if (redirecting) {
    return (
      <div style={{ padding: "80px 24px", textAlign: "center", color: "#888" }}>
        <div style={{ fontSize: 14 }}>Presmerovávam na stránku obchodu...</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px 64px" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media(max-width: 768px) {
          .hl-main { flex-direction: column !important; }
          .hl-sidebar { width: 100% !important; }
        }
        .product-card:hover { border-color: #22C55E !important; box-shadow: 0 4px 20px rgba(34,197,94,0.10) !important; }
        .line-clamp { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      `}</style>

      <div className="hl-main" style={{ display: "flex", gap: 28, alignItems: "flex-start" }}>

        {/* LEFT: Product results (70%) */}
        <div style={{ flex: "0 0 68%", minWidth: 0 }}>
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px", color: "#1d1d1f" }}>
              {categoryLabel
                ? <>{categoryLabel} <span style={{ color: "#22C55E" }}>za najlepšiu cenu</span></>
                : <>Výsledky pre: <span style={{ color: "#22C55E" }}>{q}</span></>
              }
            </h1>
            <div style={{ fontSize: 13, color: "#888" }}>
              Produkty z feedov a obchodov — zoradené podľa ceny, s dostupnými kupónmi a akciami
            </div>
          </div>

          {loadingProducts && (
            <div style={{ padding: "48px 0", textAlign: "center" }}>
              <div style={{
                width: 32, height: 32, border: "3px solid #f0f0f0", borderTopColor: "#22C55E",
                borderRadius: "50%", margin: "0 auto 12px", animation: "spin 0.8s linear infinite",
              }} />
              <div style={{ color: "#888", fontSize: 14 }}>Hľadám produkty...</div>
            </div>
          )}

          {!loadingProducts && products.length > 0 && products.map((p, i) => {
            const isCheapest = p.isCheapest === true;
            const ctaIsHeureka = p.outboundType === "heureka_fallback";
            return (
            <div
              key={i}
              className="product-card"
              style={{
                background: "#fff", borderRadius: 12,
                border: isCheapest ? "1.5px solid #22C55E" : "1px solid #e5e7eb",
                padding: "16px 18px", marginBottom: 10,
                display: "flex", gap: 16, alignItems: "flex-start",
                transition: "border-color 0.15s, box-shadow 0.15s",
              }}
            >
              <ShopFavicon domain={p.domain || ""} name={p.domain || ""} size={48} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <a
                  href={p.url}
                  target="_blank"
                  rel="nofollow noopener noreferrer"
                  style={{ fontWeight: 600, fontSize: 15, color: "#1d1d1f", textDecoration: "none", display: "block", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  {p.name}
                </a>
                <div style={{ fontSize: 12, color: "#aaa", marginBottom: 8 }}>{p.domain}</div>

                {/* Dostupný kupón / akcia obchodu */}
                {(p.coupon || p.deal) && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 10 }}>
                    {p.coupon && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#16A34A" }}>🏷️ Kupón:</span>
                        <RevealCode code={p.coupon.code} link={p.coupon.link || undefined} />
                      </span>
                    )}
                    {p.deal && (
                      <a
                        href={p.deal.link || "#"}
                        target="_blank"
                        rel="nofollow noopener noreferrer"
                        onClick={() => trackClick({
                          type: "action_outbound",
                          shopSlug: p.domain ? normalizeShopSlug(p.domain) : null,
                          destination: p.deal?.link || null,
                          destinationDomain: p.domain || null,
                          query: q || null,
                        })}
                        style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "#EA580C", textDecoration: "none", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 6, padding: "4px 8px" }}
                      >
                        🔥 Akcia ↗
                      </a>
                    )}
                  </div>
                )}

                {p.affiliateUrl && (
                  <a
                    href={p.affiliateUrl}
                    target="_blank"
                    rel="nofollow noopener noreferrer"
                    onClick={() => trackClick({
                      type: ctaIsHeureka ? "heureka_fallback" : "product_outbound",
                      shopSlug: p.domain ? normalizeShopSlug(p.domain) : null,
                      productSlug: typeof p.url === "string" && p.url.startsWith("/produkt/") ? p.url.slice("/produkt/".length) : null,
                      destination: p.affiliateUrl || null,
                      destinationDomain: ctaIsHeureka ? "heureka.sk" : p.domain || null,
                      query: q || null,
                    })}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "8px 18px", borderRadius: 8,
                      background: "#22C55E", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none",
                    }}
                  >
                    {ctaIsHeureka ? "Porovnať ponuky na Heureke ↗" : "Otvoriť v obchode ↗"}
                  </a>
                )}
              </div>
              {p.price && (
                <div style={{ flexShrink: 0, textAlign: "right", paddingTop: 2 }}>
                  <div style={{ fontWeight: 800, fontSize: 16, color: isCheapest ? "#16A34A" : "#1d1d1f", whiteSpace: "nowrap" }}>
                    {p.price}
                  </div>
                  {p.secondaryPrice && (
                    <div
                      title="Orientačný prepočet podľa aktuálne nastaveného kurzu."
                      style={{ fontSize: 11, color: "#6b7280", marginTop: 2, whiteSpace: "nowrap" }}
                    >
                      {p.secondaryPrice}
                    </div>
                  )}
                  {isCheapest && (
                    <div style={{ fontSize: 10, fontWeight: 800, color: "#16A34A", marginTop: 3, whiteSpace: "nowrap" }}>
                      NAJNIŽŠIA CENA
                    </div>
                  )}
                </div>
              )}
            </div>
          );})}

          {/* Nedostatok ponúk — máme nejaké produkty, ale málo → CTA na Heureku */}
          {!loadingProducts && products.length > 0 && products.length < MIN_ENOUGH && (
            <HeurekaCTA
              q={q}
              heurekaHaffId={heurekaHaffId}
              title="Nenašli sme dostatok ponúk"
              subtitle="V našich feedoch máme len pár výsledkov. Pozri širšiu ponuku a porovnaj ceny na Heureke."
            />
          )}

          {/* Žiadny produkt — nezobraz prázdnu stránku, ukáž veľké Heureka CTA */}
          {!loadingProducts && products.length === 0 && q && (
            <HeurekaCTA
              q={q}
              heurekaHaffId={heurekaHaffId}
              title={`Pre „${q}" sme nenašli produkt v našich feedoch`}
              subtitle="Nevadí — na Heureke nájdeš ponuky od stoviek overených predajcov a porovnáš ceny."
            />
          )}
        </div>

        {/* RIGHT: Sidebar (30%) */}
        <div className="hl-sidebar" style={{ width: 300, flexShrink: 0, display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Načítavanie kupónov */}
          {loadingCoupons && (
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: "18px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
              <div style={{ color: "#aaa", fontSize: 13, textAlign: "center", padding: "12px 0" }}>Načítavam kupóny...</div>
            </div>
          )}

          {/* Kupóny box (s kódom) — skrytý keď nemá obsah */}
          {!loadingCoupons && codeCoupons.length > 0 && (
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: "18px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
                <span>🏷️</span> Kupóny
              </div>
              {codeCoupons.slice(0, 5).map((c, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4, padding: "10px 0", borderBottom: i < Math.min(codeCoupons.length, 5) - 1 ? "1px solid #f5f5f5" : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <CouponTypeBadge kind="kupon" />
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#1d1d1f", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {(c.title || "").length > 38 ? (c.title || "").slice(0, 38) + "…" : c.title}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "#aaa" }}>{c.shopName ?? c.campaign_name}</div>
                  <div style={{ marginTop: 2 }}><RevealCode code={c.code || ""} link={c.affiliate_link || c.url || undefined} /></div>
                </div>
              ))}
              {(() => {
                // Odkaz na stránku obchodu prvého kupónu — nie na /kupony/<dopyt>,
                // ktorý nemusí existovať
                const shopSlug = normalizeShopSlug(codeCoupons[0]?.shopName ?? codeCoupons[0]?.campaign_name ?? "");
                return shopSlug ? (
                  <a href={`/kupony/${shopSlug}`} style={{ display: "block", marginTop: 10, fontSize: 13, color: "#22C55E", textDecoration: "none", fontWeight: 600 }}>
                    Všetky kupóny ›
                  </a>
                ) : null;
              })()}
            </div>
          )}

          {/* Akcie box (bez kódu) — skrytý keď nemá obsah */}
          {!loadingCoupons && dealCoupons.length > 0 && (
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: "18px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
                <span>🔥</span> Akcie
              </div>
              {dealCoupons.slice(0, 5).map((c, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4, padding: "10px 0", borderBottom: i < Math.min(dealCoupons.length, 5) - 1 ? "1px solid #f5f5f5" : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <CouponTypeBadge kind="akcia" />
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#1d1d1f", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {(c.title || "").length > 38 ? (c.title || "").slice(0, 38) + "…" : c.title}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "#aaa" }}>{c.shopName ?? c.campaign_name}</div>
                  <a href={c.affiliate_link || c.url || "#"} target="_blank" rel="nofollow noopener noreferrer"
                    onClick={() => trackClick({
                      type: "action_outbound",
                      shopSlug: normalizeShopSlug(c.shopName ?? c.campaign_name ?? ""),
                      destination: c.affiliate_link || c.url || null,
                      query: q || null,
                    })}
                    style={{ fontSize: 12, color: "#22C55E", textDecoration: "none", fontWeight: 600 }}>
                    Prejsť na ponuku ↗
                  </a>
                </div>
              ))}
            </div>
          )}

          {/* Letáky box */}
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: "18px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
              <span>🗞️</span> Letáky obchodov
            </div>
            {[
              { name: "Lidl", slug: "lidl", color: "#FFD700", textColor: "#333", letter: "L" },
              { name: "Kaufland", slug: "kaufland", color: "#E8001D", textColor: "#fff", letter: "K" },
              { name: "Tesco", slug: "tesco", color: "#003580", textColor: "#fff", letter: "T" },
              { name: "Billa", slug: "billa", color: "#E8001D", textColor: "#fff", letter: "B" },
            ].map((l) => (
              <Link key={l.slug} href={`/letaky/${l.slug}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #f5f5f5", textDecoration: "none" }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: l.color, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: l.textColor, fontWeight: 800, fontSize: 13 }}>
                  {l.letter}
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "#1d1d1f" }}>{l.name}</div>
              </Link>
            ))}
            <Link href="/letaky" style={{ display: "block", marginTop: 10, fontSize: 13, color: "#22C55E", textDecoration: "none", fontWeight: 600 }}>
              Zobraziť všetky letáky ›
            </Link>
          </div>

          {/* Heureka box */}
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: "18px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <span>🔍</span> Porovnajte cenu na Heureke
            </div>
            <p style={{ fontSize: 13, color: "#666", margin: "0 0 14px", lineHeight: 1.5 }}>
              Nájdite najlepšie ceny od overených predajcov.
            </p>
            <a
              href={heurekaSearchHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackClick({ type: "heureka_fallback", destination: heurekaSearchHref, destinationDomain: "heureka.sk", query: q || null })}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 16px", borderRadius: 10, background: "#22C55E", color: "#fff", fontWeight: 700, fontSize: 14, textDecoration: "none" }}
            >
              🔍 Porovnať na Heureke ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SearchPageClient({ heurekaHaffId }: { heurekaHaffId?: string }) {
  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <Nav />
      <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "#aaa" }}>Načítavam...</div>}>
        <SearchResults heurekaHaffId={heurekaHaffId} />
      </Suspense>
      <Footer />
    </div>
  );
}
