import ShopFavicon from "@/components/ShopFavicon";
import { compareShopsByPriority } from "@/lib/shop-priority";
import AdBanner from "@/components/AdBanner";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import HeroSearch from "@/components/HeroSearch";
import TodayDeals, { type DealItem } from "@/components/TodayDeals";
import TrackedLink from "@/components/TrackedLink";
import { getStaticSales } from "@/lib/static-data";
import { getLatestPosts, categoryLabel } from "@/lib/blog";
import { AFFIAL_SHOPS, buildAffialTrackingUrl } from "@/lib/affial-shops";
import { AFFIAL_COUPONS } from "@/lib/affial-coupons";
import { TAXONOMY, type CategoryId } from "@/lib/taxonomy";
import { getCategoryProductCounts } from "@/lib/heureka/query";

export const revalidate = 3600;

export const metadata = {
  title: "Zlavickovo ✂️ Nájdi najvýhodnejší nákup — ceny, kupóny a akcie",
  description: "Vyhľadaj produkt a porovnaj ceny v našich feedoch. Zlavickovo ti ukáže ponuky zoradené podľa ceny a dostupné kupóny a akcie pred nákupom.",
  alternates: { canonical: "https://www.zlavickovo.sk" },
  openGraph: {
    title: "Zlavickovo – Nájdi najvýhodnejší nákup",
    description: "Porovnaj ceny v našich feedoch a nájdi dostupné kupóny pred nákupom.",
    url: "https://www.zlavickovo.sk", type: "website", locale: "sk_SK",
  },
  twitter: {
    card: "summary_large_image",
    title: "Zlavickovo ✂️ Nájdi najvýhodnejší nákup",
    description: "Porovnaj ceny v našich feedoch a nájdi dostupné kupóny pred nákupom.",
  },
};

const ORANGE = "#F97316";
const ORANGE_DARK = "#EA580C";
const DARK = "#0F172A";

// ── Obľúbené obchody (fixný zoznam podľa zadania) ──
const FAVOURITE_SHOPS: { name: string; slug: string; domain: string }[] = [
  { name: "Alza", slug: "alza", domain: "alza.sk" },
  { name: "Notino", slug: "notino", domain: "notino.sk" },
  { name: "Datart", slug: "datart", domain: "datart.sk" },
  { name: "Mall", slug: "mall", domain: "mall.sk" },
  { name: "Zalando", slug: "zalando", domain: "zalando.sk" },
  { name: "About You", slug: "about-you", domain: "aboutyou.sk" },
  { name: "Lidl", slug: "lidl", domain: "lidl.sk" },
  { name: "Dr. Max", slug: "dr-max", domain: "drmax.sk" },
  { name: "GymBeam", slug: "gymbeam", domain: "gymbeam.sk" },
  { name: "Decathlon", slug: "decathlon", domain: "decathlon.sk" },
];

// ── Populárne kategórie (fixné poradie podľa zadania) ──
const POPULAR_CATEGORY_IDS: CategoryId[] = [
  "elektronika", "moda", "byvanie", "krasa", "sport", "zdravie", "potraviny", "deti",
];

const HOW_STEPS = [
  { emoji: "🔎", title: "Nájdeme produkt", desc: "Zadáš, čo hľadáš, a my prehľadáme produktové feedy aj obchody." },
  { emoji: "💶", title: "Zoradíme ponuky podľa ceny", desc: "Výsledky zobrazíme od najnižšej ceny a zvýrazníme najvýhodnejšiu ponuku." },
  { emoji: "🎟️", title: "Ukážeme dostupné kupóny a akcie", desc: "Pri obchodoch zobrazíme aktívne zľavové kódy a prebiehajúce akcie pred nákupom." },
];

function domainOf(c: any): string {
  return (c.campaign?.url || c.campaign?.website_url || "")
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/\/.*$/, "");
}

function pctOf(txt: string): string | null {
  const m = (txt || "").match(/(\d+)\s*%/);
  return m ? `-${m[1]}%` : null;
}

function parseAffialExpiry(e: string): string | null {
  const m = (e || "").match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
}

export default async function Home() {
  const sales = getStaticSales();
  const latestPosts = getLatestPosts(3);
  const categoryCounts = await getCategoryProductCounts().catch(() => ({} as Record<string, number>));

  // ── "Najlepšie zľavy dnes" — mix KUPÓN + AKCIA, len trackované affiliate odkazy, bez expirovaných ──
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const notExpired = (v?: string | null) => {
    if (!v) return true;
    const d = new Date(v);
    return isNaN(d.getTime()) || d >= today;
  };

  // Kupóny z Dognet (majú kód + trackovaný go.dognet odkaz)
  const dognetKupony: DealItem[] = sales
    .filter((c: any) => c.code?.trim() && (c.affiliate_link || c.url) && notExpired(c.valid_to))
    .map((c: any) => ({
      kind: "kupon" as const,
      shopName: c.campaign?.name || "Obchod",
      domain: domainOf(c),
      title: c.title || c.description || `Zľava v ${c.campaign?.name || "obchode"}`,
      discount: pctOf(c.title || c.description || ""),
      code: c.code,
      affiliateLink: c.affiliate_link || c.url,
      validTo: c.valid_to,
    }));

  // Kupóny z Affial (account-level tracker → vždy trackované, nikdy direct URL)
  const affialShopMap = new Map(AFFIAL_SHOPS.map((s) => [s.domain, s]));
  const affialKupony: DealItem[] = AFFIAL_COUPONS
    .map((c) => ({ ...c, validTo: parseAffialExpiry(c.expires) }))
    .filter((c) => notExpired(c.validTo))
    .map((c) => {
      const shop = affialShopMap.get(c.domain);
      return {
        kind: "kupon" as const,
        shopName: c.shop.replace(/\.(sk|cz|eu|com)$/i, ""),
        domain: c.domain,
        title: `Zľava ${c.discount} na nákup s kódom`,
        discount: c.discount,
        code: c.code,
        affiliateLink: shop?.affiliateUrl ?? buildAffialTrackingUrl(`https://${c.domain}`),
        validTo: c.validTo,
      };
    });

  // Akcie z Dognet (bez kódu, trackovaný go.dognet odkaz)
  const dognetAkcie: DealItem[] = sales
    .filter((c: any) => !c.code?.trim() && c.url && notExpired(c.valid_to))
    .map((c: any) => ({
      kind: "akcia" as const,
      shopName: c.campaign?.name || "Obchod",
      domain: domainOf(c),
      title: c.title || c.description || `Akcia v ${c.campaign?.name || "obchode"}`,
      discount: pctOf(c.title || c.description || ""),
      affiliateLink: c.url,
      validTo: c.valid_to,
    }));

  const byPrio = (arr: DealItem[]) =>
    [...arr].sort((a, b) =>
      compareShopsByPriority({ name: a.shopName, domain: a.domain }, { name: b.shopName, domain: b.domain })
    );
  const kupony = byPrio([...dognetKupony, ...affialKupony]);
  const akcie = byPrio(dognetAkcie);

  // Interleave kupón/akcia, jeden obchod max raz → pestrý mix, cap 12
  const deals: DealItem[] = [];
  const seenShop = new Set<string>();
  const MAX_DEALS = 12;
  let ki = 0, ai = 0;
  const pushUnique = (d?: DealItem) => {
    if (!d) return;
    const key = d.shopName.toLowerCase().trim();
    if (seenShop.has(key)) return;
    seenShop.add(key);
    deals.push(d);
  };
  while (deals.length < MAX_DEALS && (ki < kupony.length || ai < akcie.length)) {
    const before = deals.length;
    while (ki < kupony.length && deals.length === before) pushUnique(kupony[ki++]);
    if (deals.length >= MAX_DEALS) break;
    const before2 = deals.length;
    while (ai < akcie.length && deals.length === before2) pushUnique(akcie[ai++]);
    if (before === deals.length && ki >= kupony.length && ai >= akcie.length) break;
  }

  // Obľúbené kategórie s doplnkovým textom podľa počtu produktov
  const popularCategories = POPULAR_CATEGORY_IDS.map((id) => TAXONOMY[id]);

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff", fontFamily: "system-ui,-apple-system,sans-serif", color: "#1d1d1f" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Organization",
            "@id": "https://www.zlavickovo.sk/#organization",
            "name": "Zlavickovo",
            "url": "https://www.zlavickovo.sk",
            "logo": "https://www.zlavickovo.sk/favicon.ico",
          },
          {
            "@type": "WebSite",
            "@id": "https://www.zlavickovo.sk/#website",
            "name": "Zlavickovo",
            "url": "https://www.zlavickovo.sk",
            "publisher": { "@id": "https://www.zlavickovo.sk/#organization" },
            "potentialAction": {
              "@type": "SearchAction",
              "target": { "@type": "EntryPoint", "urlTemplate": "https://www.zlavickovo.sk/hladat?q={search_term_string}" },
              "query-input": "required name=search_term_string",
            },
          },
        ],
      }) }} />

      <style>{`
        .see-all { font-size: 14px; color: ${ORANGE_DARK}; text-decoration: none; font-weight: 700; }
        .see-all:hover { text-decoration: underline; }
        .sec-title { font-size: clamp(20px, 2.6vw, 26px); font-weight: 800; color: #1d1d1f; margin: 0; letter-spacing: -0.4px; }
        .sec-sub { font-size: 14px; color: #6b7280; margin: 6px 0 0; }
        .shop-card-hp { transition: transform .18s ease, box-shadow .18s ease, border-color .15s; }
        .shop-card-hp:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.10) !important; border-color: ${ORANGE} !important; }
        .cat-tile2 { transition: transform .15s ease, box-shadow .15s ease, border-color .15s; }
        .cat-tile2:hover { transform: translateY(-3px); box-shadow: 0 8px 22px rgba(0,0,0,0.08) !important; border-color: ${ORANGE} !important; }
        .how-card { transition: transform .15s ease, box-shadow .15s ease; }
        .blog-card-link { transition: transform .18s ease, box-shadow .18s ease; }
        .blog-card-link:hover { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(0,0,0,0.08) !important; }
        @media(max-width: 960px) {
          .shops-grid-hp { grid-template-columns: repeat(4, 1fr) !important; }
          .cats-grid { grid-template-columns: repeat(3, 1fr) !important; }
          .how-grid { grid-template-columns: 1fr !important; }
          .blog-grid { grid-template-columns: 1fr !important; }
          .explain-grid { grid-template-columns: 1fr !important; }
        }
        @media(max-width: 560px) {
          .shops-grid-hp { grid-template-columns: repeat(3, 1fr) !important; }
          .cats-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>

      <Nav />

      {/* ── 1. HERO — vyhľadávanie produktu alebo obchodu ── */}
      <div style={{ background: `linear-gradient(135deg, ${DARK} 0%, #1E293B 60%, #27364a 100%)`, padding: "56px 20px 44px" }}>
        <div style={{ maxWidth: 820, margin: "0 auto", textAlign: "center" }}>
          <h1 style={{ fontSize: "clamp(28px, 5vw, 46px)", fontWeight: 800, color: "#fff", letterSpacing: "-1.2px", lineHeight: 1.14, margin: "0 0 16px" }}>
            Nájdi najvýhodnejší nákup
          </h1>
          <p style={{ fontSize: "clamp(15px, 2vw, 19px)", color: "#cbd5e1", margin: "0 auto 28px", lineHeight: 1.55, maxWidth: 640 }}>
            Porovnaj ceny v našich feedoch a nájdi dostupné kupóny pred nákupom.
          </p>
          <div style={{ maxWidth: 640, margin: "0 auto" }}>
            <HeroSearch
              placeholder="Zadaj produkt, napr. iPhone, matrac, proteín, tenisky…"
              ctaLabel="Hľadať"
            />
          </div>
        </div>
      </div>

      {/* ── 2. Vysvetlenie pod searchom ── */}
      <section style={{ maxWidth: 1000, margin: "0 auto", padding: "36px 20px 8px" }}>
        <div className="explain-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {[
            { n: "1", t: "Nájdeme produkt vo feedoch a obchodoch" },
            { n: "2", t: "Zoradíme ponuky podľa ceny" },
            { n: "3", t: "Ukážeme dostupné kupóny a akcie" },
          ].map((s) => (
            <div key={s.n} style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", borderRadius: 14, background: "#f8f9fa", border: "1px solid #eceff3" }}>
              <span style={{ width: 34, height: 34, borderRadius: 10, background: ORANGE, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 15, flexShrink: 0 }}>{s.n}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#1d1d1f", lineHeight: 1.35 }}>{s.t}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, padding: "12px 16px", borderRadius: 10, background: "#fff7ed", border: `1px solid ${ORANGE}33`, fontSize: 13, color: "#9a3412", textAlign: "center" }}>
          ℹ️ Ceny sú z posledného importu feedov a môžu sa líšiť. Kupón nemusí platiť na každý produkt.
        </div>
      </section>

      {/* ── 3. NAJLEPŠIE ZĽAVY DNES ── */}
      {deals.length > 0 && (
        <section style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 20px 0" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            <div>
              <h2 className="sec-title">🔥 Najlepšie zľavy dnes</h2>
              <p className="sec-sub">Aktuálne kupóny a akcie z obchodov — bez expirovaných ponúk</p>
            </div>
            <a href="/kupony" className="see-all">Všetky kupóny →</a>
          </div>
          <TodayDeals deals={deals} />
        </section>
      )}

      {/* ── 4. OBĽÚBENÉ OBCHODY ── */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <div>
            <h2 className="sec-title">🏪 Obľúbené obchody</h2>
            <p className="sec-sub">Známe slovenské a české e-shopy — pozri dostupné ponuky</p>
          </div>
          <a href="/obchody" className="see-all">Všetky obchody →</a>
        </div>
        <div className="shops-grid-hp" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
          {FAVOURITE_SHOPS.map((shop) => (
            <TrackedLink key={shop.slug} href={`/kupony/${shop.slug}`} className="shop-card-hp"
              type="shop_outbound" shopSlug={shop.slug} destinationDomain={shop.domain}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "20px 10px 16px", borderRadius: 16, background: "#fff", border: "1.5px solid #eceff3", textDecoration: "none", boxShadow: "0 2px 6px rgba(0,0,0,0.04)" }}>
              <ShopFavicon domain={shop.domain} name={shop.name} size={44} />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1d1d1f", lineHeight: 1.3 }}>{shop.name}</div>
                <div style={{ fontSize: 12, color: ORANGE_DARK, fontWeight: 600, marginTop: 4 }}>Zobraziť ponuky →</div>
              </div>
            </TrackedLink>
          ))}
        </div>
      </section>

      {/* ── AD BANNER ── */}
      <div style={{ padding: "40px 20px 0", maxWidth: 1200, margin: "0 auto" }}>
        <AdBanner slot="between-coupons" />
      </div>

      {/* ── 5. AKO TO FUNGUJE ── */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 20px 0" }}>
        <div style={{ marginBottom: 20 }}>
          <h2 className="sec-title">💡 Ako to funguje</h2>
          <p className="sec-sub" style={{ maxWidth: 720 }}>
            Zlavickovo kombinuje produktové feedy, kupóny a affiliate ponuky. Výsledky zoradíme podľa ceny a pri obchodoch ukážeme dostupné kupóny a akcie, aby si nakúpil výhodnejšie.
          </p>
        </div>
        <div className="how-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          {HOW_STEPS.map((step) => (
            <div key={step.title} className="how-card" style={{ display: "flex", flexDirection: "column", gap: 8, padding: "22px 22px", borderRadius: 16, background: "#f8f9fa", border: "1px solid #eceff3" }}>
              <span style={{ fontSize: 30 }}>{step.emoji}</span>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#1d1d1f", lineHeight: 1.35 }}>{step.title}</div>
              <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.55 }}>{step.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 6. POPULÁRNE KATEGÓRIE ── */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <div>
            <h2 className="sec-title">🗂️ Populárne kategórie</h2>
            <p className="sec-sub">Nájdi obchody a kupóny podľa toho, čo hľadáš</p>
          </div>
          <a href="/kategoria" className="see-all">Všetky kategórie →</a>
        </div>
        <div className="cats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          {popularCategories.map((cat) => {
            const count = categoryCounts[cat.id];
            return (
              <a key={cat.id} href={`/kategoria/${cat.id}`} className="cat-tile2"
                style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 18px", borderRadius: 16, background: "#fff", border: "1.5px solid #eceff3", textDecoration: "none", boxShadow: "0 2px 6px rgba(0,0,0,0.04)" }}>
                <span style={{ width: 50, height: 50, borderRadius: 14, background: cat.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>{cat.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#1d1d1f" }}>{cat.label}</div>
                  <div style={{ fontSize: 13, color: "#6b7280", marginTop: 3 }}>
                    {count ? `${count.toLocaleString("sk-SK")} produktov` : "Kupóny a zľavy"}
                  </div>
                </div>
                <span style={{ fontSize: 15, color: cat.color, fontWeight: 800, flexShrink: 0 }}>→</span>
              </a>
            );
          })}
        </div>
      </section>

      {/* ── BLOG ── */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <div>
            <h2 className="sec-title">📝 Z blogu</h2>
            <p className="sec-sub">Tipy, ako nakupovať výhodnejšie</p>
          </div>
          <a href="/blog" className="see-all">Všetky články →</a>
        </div>
        {latestPosts.length > 0 ? (
          <div className="blog-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {latestPosts.map((post: any) => (
              <a key={post.slug} href={`/blog/${post.slug}`} className="blog-card-link"
                style={{ display: "flex", flexDirection: "column", textDecoration: "none", background: "#fff", borderRadius: 16, border: "1.5px solid #eceff3", overflow: "hidden", boxShadow: "0 2px 6px rgba(0,0,0,0.04)" }}>
                <div style={{ padding: "20px 20px 14px", flex: 1 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 100, background: "#fff7ed", color: ORANGE_DARK, display: "inline-block", marginBottom: 12 }}>{categoryLabel(post.category)}</span>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#1d1d1f", lineHeight: 1.45 }}>{post.title}</div>
                </div>
                <div style={{ padding: "10px 20px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #f5f5f5" }}>
                  <span style={{ fontSize: 13, color: "#9ca3af" }}>{new Date(post.date).toLocaleDateString("sk-SK")}</span>
                  <span style={{ fontSize: 14, color: ORANGE_DARK, fontWeight: 700 }}>Čítať →</span>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div style={{ padding: "36px", textAlign: "center", color: "#9ca3af", background: "#f8f9fa", borderRadius: 16, border: "1px solid #eceff3", fontSize: 14 }}>
            Články pripravujeme.
          </div>
        )}
      </section>

      <div style={{ height: 80 }} />
      <Footer />
    </div>
  );
}
