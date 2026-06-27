import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import ShopLogo from "@/components/ShopLogo";
import CouponCard from "@/components/CouponCard";
import { getCoupons } from "@/lib/dognet";

export const revalidate = 3600;

const CATEGORIES: Record<string, {
  title: string; emoji: string; desc: string;
  keywords: string[]; shops: string[];
}> = {
  mobily: {
    title: "Mobily a smartfóny", emoji: "📱",
    desc: "Kupóny a zľavy na smartfóny, tablety a príslušenstvo.",
    keywords: ["iphone", "samsung", "xiaomi", "mobil", "smartphone"],
    shops: ["alza", "mall", "datart", "nay", "okay"],
  },
  parfumy: {
    title: "Parfumy a kozmetika", emoji: "💄",
    desc: "Zľavové kódy na parfumy, kozmetiku a starostlivosť o telo.",
    keywords: ["parfum", "kozmetika", "krém", "makeup"],
    shops: ["notino", "dm", "fann", "vivantis"],
  },
  elektronika: {
    title: "Elektronika", emoji: "💻",
    desc: "Kupóny na laptopy, TV, foto, audio a domáce spotrebiče.",
    keywords: ["laptop", "tv", "audio", "kamera", "elektronika"],
    shops: ["alza", "mall", "datart", "nay", "samsung", "lenovo"],
  },
  moda: {
    title: "Móda a oblečenie", emoji: "👗",
    desc: "Zľavy na oblečenie, obuv a módne doplnky.",
    keywords: ["oblecenie", "topanky", "moda", "rifle"],
    shops: ["zalando", "about you", "answear", "zara", "hm", "asos"],
  },
  sport: {
    title: "Šport a outdoor", emoji: "⚽",
    desc: "Kupóny na športové vybavenie, oblečenie a obuv.",
    keywords: ["sport", "futbal", "beh", "outdoor", "fitness"],
    shops: ["sportisimo", "decathlon", "intersport"],
  },
  domacnost: {
    title: "Dom a záhrada", emoji: "🏠",
    desc: "Zľavy na nábytok, dekorácie, záhradné potreby.",
    keywords: ["nabytok", "dom", "zahrada", "kuchyna"],
    shops: ["ikea", "mall", "4home", "obi", "hornbach"],
  },
};

const SHOP_COLORS = ["#E8001D","#0065BD","#00A551","#FF6900","#7B2FBE","#003580","#D32F2F","#FF4081"];
function shopColor(name: string) { return SHOP_COLORS[name.charCodeAt(0) % SHOP_COLORS.length]; }

export function generateStaticParams() {
  return Object.keys(CATEGORIES).map(slug => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cat = CATEGORIES[slug];
  if (!cat) return {};
  return {
    title: `${cat.title} - kupóny, cashback a zľavy | Zlavickovo.sk`,
    description: cat.desc,
    alternates: { canonical: `https://zlavickovo.sk/kategoria/${slug}` },
  };
}

export default async function KategoriaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cat = CATEGORIES[slug];

  if (!cat) {
    return (
      <div style={{ minHeight: "100vh", background: "#fff" }}>
        <Nav />
        <div style={{ maxWidth: 700, margin: "80px auto", textAlign: "center", padding: "0 24px" }}>
          <div style={{ fontSize: 48 }}>🔍</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: "16px 0 8px" }}>Kategória nenájdená</h1>
          <a href="/obchody" style={{ color: "#22C55E", textDecoration: "none", fontWeight: 600 }}>← Späť na obchody</a>
        </div>
        <Footer />
      </div>
    );
  }

  let coupons: any[] = [];
  try {
    const all = await getCoupons();
    coupons = all.filter((c: any) => {
      const name = (c.campaign?.name || "").toLowerCase();
      return cat.shops.some(s => name.includes(s)) || cat.keywords.some(k => (c.title || "").toLowerCase().includes(k));
    }).slice(0, 12);
  } catch {}

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <Nav />

      {/* Header */}
      <div style={{ background: "#F0FDF4", borderBottom: "1px solid #BBF7D0", padding: "40px 24px 32px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>
            <a href="/" style={{ color: "#888", textDecoration: "none" }}>Zlavickovo</a> › <a href="/obchody" style={{ color: "#888", textDecoration: "none" }}>Kategórie</a> › {cat.title}
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 8px", color: "#1d1d1f" }}>
            {cat.emoji} {cat.title}
          </h1>
          <p style={{ fontSize: 15, color: "#555", margin: 0 }}>{cat.desc}</p>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px 64px" }}>

        {/* Shops */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 16px" }}>Obchody v tejto kategórii</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 10 }}>
            {cat.shops.map(shop => (
              <a key={shop} href={`/kupony/${shop.replace(/\s+/g, "-")}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px", borderRadius: 10, background: "#fff", border: "1.5px solid #e8e8e8", textDecoration: "none" }}>
                <ShopLogo name={shop} size={36} radius={8} color={shopColor(shop)} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "#1d1d1f" }}>{shop.charAt(0).toUpperCase() + shop.slice(1)}</span>
              </a>
            ))}
          </div>
        </section>

        {/* Kupóny */}
        <section>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 16px" }}>Kupóny pre {cat.title.toLowerCase()}</h2>
          {coupons.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 12 }}>
              {coupons.map((coupon: any) => {
                const token = coupon.code ? Buffer.from(`cat:${coupon.code}`).toString("base64") : null;
                const { code: _c, ...couponData } = coupon;
                return <CouponCard key={coupon.id} coupon={couponData} token={token} />;
              })}
            </div>
          ) : (
            <div style={{ padding: "40px", textAlign: "center", color: "#aaa", background: "#fff", borderRadius: 12, border: "1px solid #e8e8e8" }}>
              Momentálne žiadne kupóny. Skontroluj neskôr.
            </div>
          )}
        </section>

        {/* Future feeds note */}
        <div style={{ marginTop: 32, padding: "16px 20px", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 10, fontSize: 13, color: "#16A34A" }}>
          💡 Čoskoro tu pribudnú produkty z partnerských obchodov (AWIN, Dognet feed, CJ).
        </div>
      </div>

      <Footer />
    </div>
  );
}
