import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import ShopFavicon from "@/components/ShopFavicon";
import TrackedLink from "@/components/TrackedLink";
import { getVypredaje, type VypredajItem } from "@/lib/vypredaje";
import type { Metadata } from "next";

export const revalidate = 3600;

// Zelená značka webu (žiadna oranžová téma) — primárna #22C55E, tmavá #16A34A
const ORANGE = "#22C55E";
const ORANGE_DARK = "#16A34A";
const PINK = "#16A34A";

export const metadata: Metadata = {
  title: "Aktuálne akcie a výpredaje obchodov",
  description: "Čerstvé akcie, zľavy a výpredaje slovenských obchodov zo zapojených affiliate sietí. Ponuky pravidelne aktualizujeme na jednom mieste.",
  alternates: { canonical: "https://www.zlavickovo.sk/akcie" },
  openGraph: {
    title: "Výpredaje v e-shopoch | Zlavickovo",
    description: "Aktuálne výpredaje a akcie slovenských e-shopov na jednom mieste.",
    url: "https://www.zlavickovo.sk/akcie", type: "website", locale: "sk_SK",
  },
};

function Cta({ item, block = false }: { item: VypredajItem; block?: boolean }) {
  const style: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
    padding: "12px 22px", borderRadius: 100,
    background: `linear-gradient(180deg, ${ORANGE} 0%, ${ORANGE_DARK} 100%)`,
    color: "#fff", fontWeight: 800, fontSize: 14, textDecoration: "none",
    boxShadow: "0 4px 12px rgba(34,197,94,0.30)", whiteSpace: "nowrap",
    width: block ? "100%" : undefined,
  };
  const label = item.external ? "Pozri zľavu →" : "Zobraziť →";
  if (item.external) {
    return (
      <TrackedLink href={item.ctaUrl} target="_blank" rel="nofollow noopener noreferrer"
        type={item.clickType} shopSlug={item.shopSlug || null} destinationDomain={item.domain || null} style={style}>
        {label}
      </TrackedLink>
    );
  }
  return <a href={item.ctaUrl} style={style}>{label}</a>;
}

function Badge({ item, big = false }: { item: VypredajItem; big?: boolean }) {
  if (item.hasPct) {
    return <span style={{ color: ORANGE, fontWeight: 900, fontSize: big ? 30 : 20, letterSpacing: "-0.5px", lineHeight: 1 }}>{item.badge}</span>;
  }
  return (
    <span style={{ display: "inline-block", background: PINK, color: "#fff", fontWeight: 800, fontSize: 11, letterSpacing: "0.04em", padding: "3px 10px", borderRadius: 100 }}>
      VÝPREDAJ
    </span>
  );
}

function FeaturedCard({ item }: { item: VypredajItem }) {
  return (
    <div style={{ flex: "0 0 260px", scrollSnapAlign: "start", background: "#fff", borderRadius: 16, border: "1px solid #eee", overflow: "hidden", boxShadow: "0 2px 10px rgba(0,0,0,0.05)", display: "flex", flexDirection: "column" }}>
      <div style={{ height: 130, background: `linear-gradient(135deg, ${ORANGE} 0%, ${ORANGE_DARK} 130%)`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        <div style={{ background: "#fff", borderRadius: 12, padding: 8, boxShadow: "0 4px 14px rgba(0,0,0,0.2)" }}>
          <ShopFavicon domain={item.domain} name={item.shopName} size={46} />
        </div>
      </div>
      <div style={{ padding: "16px 16px 18px", flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
        <Badge item={item} big />
        <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.4, color: "#1d1d1f", flex: 1 }}>{item.title}</div>
        <Cta item={item} block />
      </div>
    </div>
  );
}

export default async function VypredajePage() {
  const { featured, items, total } = await getVypredaje();

  // ItemList (C2) — viditeľné akcie, každá odkazuje na stránku obchodu.
  // Bez cenových/dostupnostných tvrdení (vízia: žiadne neoverené claims).
  const itemListJsonLd = items.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Aktuálne akcie a výpredaje",
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.title,
      url: it.shopSlug
        ? `https://www.zlavickovo.sk/kupony/${it.shopSlug}`
        : "https://www.zlavickovo.sk/akcie",
    })),
  } : null;

  return (
    <div style={{ minHeight: "100vh", background: "#f7f7f8", fontFamily: "system-ui, -apple-system, sans-serif", color: "#1d1d1f" }}>
      {itemListJsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd).replace(/</g, "\\u003c") }} />}
      <style>{`
        .feat-row::-webkit-scrollbar { height: 8px; }
        .feat-row::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 100px; }
        @media(max-width: 860px) {
          .vyp-layout { grid-template-columns: 1fr !important; }
          .vyp-aside { display: none !important; }
        }
        @media(max-width: 560px) {
          .vyp-row { grid-template-columns: auto 1fr !important; }
          .row-cta { grid-column: 1 / -1; margin-top: 6px; }
          .row-cta > * { width: 100%; }
        }
      `}</style>
      <Nav />

      {/* HERO */}
      <div style={{ background: `linear-gradient(120deg, ${ORANGE_DARK} 0%, ${ORANGE} 60%, #4ADE80 100%)`, padding: "48px 20px 44px", textAlign: "center", color: "#fff" }}>
        <h1 style={{ fontSize: "clamp(30px, 5vw, 48px)", fontWeight: 900, margin: "0 0 12px", letterSpacing: "-1px", textShadow: "0 2px 12px rgba(0,0,0,0.15)" }}>Aktuálne akcie a výpredaje</h1>
        <p style={{ fontSize: "clamp(14px, 2vw, 18px)", margin: 0, opacity: 0.95 }}>
          {total} aktuálnych ponúk zo zapojených obchodov a affiliate sietí
        </p>
      </div>

      {/* FEATURED */}
      {featured.length > 0 && (
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 20px 0" }}>
          <div className="feat-row" style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 12, scrollSnapType: "x mandatory" }}>
            {featured.map((it) => <FeaturedCard key={`f-${it.id}`} item={it} />)}
          </div>
        </div>
      )}

      {/* MAIN */}
      <div className="vyp-layout" style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 20px 72px", display: "grid", gridTemplateColumns: "280px 1fr", gap: 28, alignItems: "start" }}>
        {/* Sidebar */}
        <aside className="vyp-aside" style={{ position: "sticky", top: 80, display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #ececec", padding: "20px" }}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 10 }}>Ako akcie vyberáme</div>
            <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.65, margin: 0 }}>
              Ponuky pravidelne načítavame zo zapojených affiliate sietí. Ak má akcia vlastný detail,
              môžeme pri nej ukázať aj zľavnené produkty, ktoré sa jej priamo týkajú.
            </p>
          </div>
          <div style={{ background: `linear-gradient(135deg, ${ORANGE} 0%, ${ORANGE_DARK} 100%)`, borderRadius: 14, padding: "22px 20px", textAlign: "center", color: "#fff" }}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 6 }}>🎟️ Hľadáš kupóny?</div>
            <p style={{ fontSize: 13, opacity: 0.95, margin: "0 0 14px", lineHeight: 1.5 }}>Pozri aktuálne zľavové kódy pre stovky obchodov.</p>
            <a href="/kupony" style={{ display: "inline-block", background: "#fff", color: ORANGE_DARK, fontWeight: 800, fontSize: 13, padding: "10px 20px", borderRadius: 100, textDecoration: "none" }}>Zobraziť kupóny →</a>
          </div>
        </aside>

        {/* List */}
        <main>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <span style={{ background: PINK, color: "#fff", fontWeight: 800, fontSize: 12, padding: "6px 14px", borderRadius: 100 }}>VÝPREDAJE</span>
            <span style={{ fontSize: 13, color: "#6b7280" }}>{total} ponúk</span>
          </div>

          {items.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {items.map((it, i) => <RowCardWrap key={it.id} item={it} rank={i + 1} />)}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "80px 20px", color: "#aaa", background: "#fff", borderRadius: 14, border: "1px solid #ececec" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
              <p>Momentálne pripravujeme nové výpredaje. Skontroluj neskôr.</p>
            </div>
          )}

          <div style={{ marginTop: 22, padding: "14px 18px", borderRadius: 10, background: "#f0fdf4", border: "1px solid #bbf7d0", fontSize: 12, color: "#166534" }}>
            ℹ️ Podmienky, ceny a dostupnosť sa môžu meniť. Pred nákupom si vždy over aktuálne pravidlá akcie priamo v obchode.
          </div>
        </main>
      </div>

      <Footer />
    </div>
  );
}

// wrapper kvôli responsive triede na grid riadku
function RowCardWrap({ item, rank }: { item: VypredajItem; rank: number }) {
  return (
    <div className="vyp-row" style={{ position: "relative", background: "#fff", borderRadius: 14, border: "1px solid #ececec", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", padding: "18px 20px", display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 18, alignItems: "center" }}>
      <span style={{ position: "absolute", top: -9, left: 16, background: "#1d1d1f", color: "#fff", fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", padding: "3px 9px", borderRadius: 6 }}>TOP {rank}.</span>
      <div style={{ width: 64, display: "flex", justifyContent: "center" }}>
        <ShopFavicon domain={item.domain} name={item.shopName} size={50} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
          <Badge item={item} />
          <span style={{ fontSize: 12, color: "#9ca3af" }}>{item.meta}</span>
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#1d1d1f", lineHeight: 1.35, letterSpacing: "-0.2px" }}>{item.title}</div>
        <a href={`/kupony/${item.shopSlug}`} style={{ fontSize: 12, color: ORANGE_DARK, fontWeight: 700, textDecoration: "none", marginTop: 6, display: "inline-block" }}>
          všetko od {item.shopName} →
        </a>
      </div>
      <div className="row-cta"><Cta item={item} /></div>
    </div>
  );
}
