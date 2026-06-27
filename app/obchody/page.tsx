import { getShops } from "@/lib/dognet";
import { AFFIAL_SHOPS } from "@/lib/affial-shops";
import { CATEGORIES_LIST, inferCategory } from "@/lib/categories";
import ShopLogo from "@/components/ShopLogo";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import type { Metadata } from "next";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Všetky obchody | Zlavickovo.sk",
  description: "Prehľad všetkých obchodov so zľavovými kódmi, cashbackom a kupónmi. Nájdi kupóny pre tvoj obľúbený eshop.",
};

function shopSlug(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/\./g, "");
}

interface UnifiedShop {
  name: string;
  slug: string;
  href: string;
  source: "dognet" | "affial";
  commission?: string;
  couponCount?: number;
  category: string;
  domain?: string;
}

export default async function ObchodyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").toLowerCase().trim();
  const cat = sp.cat ?? "";

  let dognetShops: { id: number; name: string; count: number }[] = [];
  try {
    dognetShops = await getShops();
  } catch {}

  // Build unified list
  const allShops: UnifiedShop[] = [
    ...dognetShops.map(s => ({
      name: s.name,
      slug: shopSlug(s.name),
      href: `/kupony/${shopSlug(s.name)}`,
      source: "dognet" as const,
      couponCount: s.count,
      category: inferCategory(s.name),
    })),
    ...AFFIAL_SHOPS.map(s => ({
      name: s.name,
      slug: s.domain.replace(".", "-"),
      href: `/kupony/${s.domain.replace(".", "-")}`,
      source: "affial" as const,
      commission: s.commission,
      category: s.category,
      domain: s.domain,
    })),
  ];

  // Filter
  const filtered = allShops.filter(s => {
    const matchQ = !q || s.name.toLowerCase().includes(q);
    const matchCat = !cat || s.category === cat;
    return matchQ && matchCat;
  });

  const totalCount = allShops.length;

  return (
    <div style={{ minHeight: "100vh", background: "#fff", fontFamily: "'Inter', system-ui, sans-serif", color: "#1d1d1f" }}>
      <style>{`
        .shop-card { transition: border-color 0.15s, box-shadow 0.15s; }
        .shop-card:hover { border-color: #22C55E !important; box-shadow: 0 4px 16px rgba(34,197,94,0.12) !important; }
        .cat-tab { transition: background 0.15s, color 0.15s; }
        .cat-tab:hover { background: #f0fdf4 !important; color: #16a34a !important; }
      `}</style>
      <Nav />

      {/* Header */}
      <div style={{ background: "#F0FDF4", borderBottom: "1px solid #BBF7D0", padding: "48px 24px 36px", textAlign: "center" }}>
        <h1 style={{ fontSize: "clamp(26px, 5vw, 42px)", fontWeight: 800, letterSpacing: "-0.5px", margin: "0 0 10px" }}>
          🏪 Všetky obchody
        </h1>
        <p style={{ color: "#555", fontSize: 15, margin: "0 0 28px" }}>
          {totalCount}+ obchodov so zľavovými kódmi a cashbackom
        </p>

        {/* Search */}
        <form method="get" action="/obchody" style={{ display: "flex", justifyContent: "center", gap: 0, maxWidth: 480, margin: "0 auto" }}>
          {cat && <input type="hidden" name="cat" value={cat} />}
          <input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Hľadaj obchod..."
            style={{
              flex: 1, padding: "12px 18px", borderRadius: "12px 0 0 12px",
              border: "2px solid #BBF7D0", borderRight: "none",
              background: "#fff", fontSize: 15, fontFamily: "inherit", outline: "none",
            }}
          />
          <button type="submit" style={{
            padding: "12px 20px", borderRadius: "0 12px 12px 0",
            border: "2px solid #22C55E", background: "#22C55E",
            color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer",
          }}>
            🔍
          </button>
        </form>
      </div>

      {/* Category tabs */}
      <div style={{ borderBottom: "1px solid #f0f0f0", background: "#fff", overflowX: "auto" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "12px 24px", display: "flex", gap: 6 }}>
          <a
            href={q ? `/obchody?q=${encodeURIComponent(q)}` : "/obchody"}
            className="cat-tab"
            style={{
              padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600,
              textDecoration: "none", whiteSpace: "nowrap",
              background: !cat ? "#22C55E" : "#f5f5f5",
              color: !cat ? "#fff" : "#555",
            }}
          >
            Všetky
          </a>
          {CATEGORIES_LIST.map(c => (
            <a
              key={c.slug}
              href={`/obchody?cat=${c.slug}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className="cat-tab"
              style={{
                padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600,
                textDecoration: "none", whiteSpace: "nowrap",
                background: cat === c.slug ? "#22C55E" : "#f5f5f5",
                color: cat === c.slug ? "#fff" : "#555",
              }}
            >
              {c.emoji} {c.label}
            </a>
          ))}
        </div>
      </div>

      {/* Results info */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "16px 24px 0" }}>
        <p style={{ fontSize: 13, color: "#888", margin: 0 }}>
          {filtered.length === 0
            ? "Žiadne obchody nenájdené"
            : `${filtered.length} obchod${filtered.length === 1 ? "" : filtered.length < 5 ? "y" : "ov"}${q ? ` pre „${q}"` : ""}${cat ? ` v kategórii ${CATEGORIES_LIST.find(c => c.slug === cat)?.label ?? cat}` : ""}`}
        </p>
      </div>

      {/* Grid */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "16px 24px 80px" }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 24px", color: "#aaa" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
            <p style={{ fontSize: 16 }}>Nenašli sme žiadne obchody. Skús iný výraz.</p>
            <a href="/obchody" style={{ color: "#22C55E", fontWeight: 600, textDecoration: "none" }}>Zobraziť všetky obchody</a>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 12 }}>
            {filtered.map((shop, i) => (
              <a
                key={`${shop.source}-${shop.slug}-${i}`}
                href={shop.href}
                className="shop-card"
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center",
                  gap: 10, padding: "22px 14px 18px", borderRadius: 14,
                  background: "#fff", border: "1.5px solid #e5e7eb",
                  textDecoration: "none", color: "#1d1d1f",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                }}
              >
                <ShopLogo name={shop.name} domain={shop.domain} size={52} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "#222", textAlign: "center", lineHeight: 1.3 }}>
                  {shop.name}
                </span>
                {shop.commission ? (
                  <span style={{ fontSize: 11, color: "#16A34A", fontWeight: 700, background: "#F0FDF4", padding: "2px 8px", borderRadius: 100 }}>
                    💰 {shop.commission}
                  </span>
                ) : shop.couponCount != null && shop.couponCount > 0 ? (
                  <span style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 600, background: "#dbeafe", padding: "2px 8px", borderRadius: 100 }}>
                    {shop.couponCount} {shop.couponCount === 1 ? "kód" : shop.couponCount < 5 ? "kódy" : "kódov"}
                  </span>
                ) : (
                  <span style={{ fontSize: 11, color: "#aaa" }}>kupóny</span>
                )}
              </a>
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
