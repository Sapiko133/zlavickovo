"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import ShopFavicon from "@/components/ShopFavicon";
import { trackClick } from "@/lib/track-click";
import { normalizeShopSlug } from "@/lib/slug";

interface SearchCoupon {
  id: string | number;
  shopName: string;
  title: string;
  code: string | null;
  link: string;
}

interface SearchLeaflet {
  slug: string;
  name: string;
  color: string;
  letter: string;
}

interface SearchResult {
  query: string;
  coupons: SearchCoupon[];
  letaky: SearchLeaflet[];
}

function domainFrom(link: string, slug: string) {
  try { return new URL(link).hostname.replace(/^www\./, ""); } catch { return `${slug}.sk`; }
}

function DealCard({ coupon, query }: { coupon: SearchCoupon; query: string }) {
  const [revealed, setRevealed] = useState(false);
  const slug = normalizeShopSlug(coupon.shopName);
  const domain = domainFrom(coupon.link, slug);

  const openOffer = () => {
    if (coupon.link && coupon.link !== "#") window.open(coupon.link, "_blank", "noopener,noreferrer");
  };
  const revealCode = () => {
    trackClick({ type: "coupon_reveal", source: "search", shopSlug: slug, couponId: String(coupon.id), couponCode: coupon.code, destination: coupon.link, destinationDomain: domain, query });
    openOffer();
    setRevealed(true);
    if (coupon.code) navigator.clipboard.writeText(coupon.code).catch(() => {});
  };
  const visitDeal = () => {
    trackClick({ type: "action_outbound", source: "search", shopSlug: slug, couponId: String(coupon.id), destination: coupon.link, destinationDomain: domain, query });
    openOffer();
  };

  return (
    <article className="search-deal-card">
      <a href={`/kupony/${slug}`} aria-label={`Všetky zľavy ${coupon.shopName}`} style={{ flexShrink: 0 }}>
        <ShopFavicon domain={domain} name={coupon.shopName} size={48} />
      </a>
      <div style={{ flex: 1, minWidth: 0 }}>
        <a href={`/kupony/${slug}`} style={{ color: "#16A34A", fontSize: 13, fontWeight: 800, textDecoration: "none" }}>{coupon.shopName}</a>
        <h2 style={{ margin: "5px 0 8px", fontSize: 17, lineHeight: 1.35, color: "#0F172A" }}>{coupon.title}</h2>
        <span style={{ fontSize: 12, color: "#64748B" }}>{coupon.code ? "Zľavový kód" : "Aktuálna akcia"}</span>
      </div>
      {coupon.code ? (
        <button type="button" onClick={revealed ? () => navigator.clipboard.writeText(coupon.code || "").catch(() => {}) : revealCode} className="deal-cta">
          {revealed ? coupon.code : "Zobraziť kód"}
        </button>
      ) : (
        <button type="button" onClick={visitDeal} className="deal-cta">Pozrieť akciu →</button>
      )}
    </article>
  );
}

function SearchContent() {
  const params = useSearchParams();
  const q = (params.get("q") || "").trim();
  const [result, setResult] = useState<SearchResult | null>(null);

  useEffect(() => {
    if (!q) return;
    const controller = new AbortController();
    fetch("/api/search-v2", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ q }), signal: controller.signal })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error("search failed")))
      .then((data: SearchResult) => setResult(data))
      .catch((error) => { if (error.name !== "AbortError") setResult({ query: q, coupons: [], letaky: [] }); });
    return () => controller.abort();
  }, [q]);

  const coupons = useMemo(() => result?.coupons ?? [], [result]);
  const loading = Boolean(q && result?.query !== q);

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", color: "#0F172A", fontFamily: "system-ui,-apple-system,sans-serif" }}>
      <style>{`
        .search-deal-card{display:flex;align-items:center;gap:16px;padding:20px;background:#fff;border:1px solid #E2E8F0;border-radius:16px;box-shadow:0 2px 8px rgba(15,23,42,.04)}
        .search-deal-card:hover{border-color:#86EFAC;box-shadow:0 8px 24px rgba(34,197,94,.09)}
        .deal-cta{min-height:44px;padding:11px 18px;border:0;border-radius:11px;background:#22C55E;color:#fff;font:800 14px system-ui;cursor:pointer;white-space:nowrap}
        .deal-cta:hover{background:#16A34A}
        @media(max-width:640px){.search-deal-card{align-items:flex-start;flex-wrap:wrap}.deal-cta{width:100%}}
      `}</style>
      <Nav />
      <main style={{ maxWidth: 920, margin: "0 auto", padding: "42px 20px 72px" }}>
        <div style={{ marginBottom: 26 }}>
          <p style={{ margin: "0 0 8px", color: "#16A34A", fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em" }}>Vyhľadávanie zliav</p>
          <h1 style={{ margin: 0, fontSize: "clamp(25px,4vw,38px)", letterSpacing: "-.7px" }}>{q ? `Akcie a kupóny pre „${q}“` : "Nájdi akciu alebo kupón"}</h1>
          <p style={{ color: "#64748B", lineHeight: 1.6 }}>Vyhľadávame ponuky zo zapojených affiliate sietí a obchodov.</p>
        </div>

        {loading && <div style={{ padding: 48, textAlign: "center", color: "#64748B" }}>Hľadám aktuálne zľavy…</div>}
        {!loading && q && coupons.length > 0 && (
          <section aria-label="Nájdené akcie a kupóny" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {coupons.map((coupon) => <DealCard key={`${coupon.id}-${coupon.shopName}`} coupon={coupon} query={q} />)}
          </section>
        )}
        {!loading && result && coupons.length === 0 && (
          <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 18, padding: "48px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 42, marginBottom: 12 }}>🔎</div>
            <h2 style={{ margin: "0 0 8px", fontSize: 20 }}>Nenašli sme zhodnú zľavu</h2>
            <p style={{ color: "#64748B", lineHeight: 1.6 }}>Skús názov obchodu alebo si pozri všetky aktuálne ponuky.</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 20 }}>
              <Link href="/akcie" className="deal-cta" style={{ textDecoration: "none" }}>Aktuálne akcie</Link>
              <Link href="/kupony" style={{ minHeight: 44, padding: "11px 18px", borderRadius: 11, border: "1px solid #CBD5E1", color: "#0F172A", fontWeight: 800, textDecoration: "none" }}>Všetky kupóny</Link>
            </div>
          </div>
        )}
        {!loading && result && result.letaky.length > 0 && (
          <section style={{ marginTop: 34 }}>
            <h2 style={{ fontSize: 21 }}>Súvisiace letáky</h2>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {result.letaky.map((leaflet) => (
                <a key={leaflet.slug} href={`/letaky/${leaflet.slug}`} style={{ padding: "14px 18px", borderRadius: 12, background: leaflet.color || "#16A34A", color: "#fff", fontWeight: 800, textDecoration: "none" }}>{leaflet.letter} · {leaflet.name}</a>
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}

export default function SearchPageClient() {
  return <Suspense fallback={<div style={{ padding: 48, textAlign: "center" }}>Načítavam…</div>}><SearchContent /></Suspense>;
}
