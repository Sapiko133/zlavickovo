import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAllFeaturedFromRedis, saveFeaturedShops, FeaturedShop } from "@/lib/featured";

const SESSION_COOKIE = "admin_session";

export const metadata = { title: "Admin – Featured obchody" };

async function login(formData: FormData) {
  "use server";
  const password = formData.get("password") as string;
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  if (!adminPassword || password !== adminPassword) {
    redirect("/admin/featured?error=1");
  }
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, adminPassword, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 8,
    path: "/",
  });
  redirect("/admin/featured");
}

async function removeShop(formData: FormData) {
  "use server";
  const slug = formData.get("slug") as string;
  const shops = await getAllFeaturedFromRedis();
  await saveFeaturedShops(shops.filter(s => s.slug !== slug));
  redirect("/admin/featured");
}

async function addShop(formData: FormData) {
  "use server";
  const name = (formData.get("name") as string).trim();
  const slug = (formData.get("slug") as string).trim();
  const color = (formData.get("color") as string).trim() || "#7C3AED";
  const promoText = (formData.get("promoText") as string).trim();
  const topDeal = (formData.get("topDeal") as string).trim();
  const featuredUntil = (formData.get("featuredUntil") as string).trim();

  if (!name || !slug || !promoText || !topDeal || !featuredUntil) {
    redirect("/admin/featured?error=missing");
  }

  const shops = await getAllFeaturedFromRedis();
  const exists = shops.some(s => s.slug === slug);
  if (exists) {
    redirect("/admin/featured?error=exists");
  }

  const newShop: FeaturedShop = { name, slug, color, promoText, topDeal, featured: true, featuredUntil };
  await saveFeaturedShops([...shops, newShop]);
  redirect("/admin/featured");
}

async function toggleShop(formData: FormData) {
  "use server";
  const slug = formData.get("slug") as string;
  const shops = await getAllFeaturedFromRedis();
  await saveFeaturedShops(shops.map(s => s.slug === slug ? { ...s, featured: !s.featured } : s));
  redirect("/admin/featured");
}

export default async function AdminFeaturedPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  const isAuth = adminPassword && session === adminPassword;

  if (!isAuth) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f9fafb", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ background: "#fff", padding: 40, borderRadius: 16, boxShadow: "0 4px 24px rgba(0,0,0,0.08)", width: "100%", maxWidth: 360 }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔒</div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Admin prístup</h1>
            <p style={{ color: "#666", fontSize: 13, marginTop: 6 }}>Zadaj heslo pre správu featured obchodov</p>
          </div>
          {params.error && (
            <div style={{ background: "#fee2e2", color: "#dc2626", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
              Nesprávne heslo.
            </div>
          )}
          <form action={login} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              type="password"
              name="password"
              placeholder="Heslo"
              required
              style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, fontFamily: "inherit", outline: "none" }}
            />
            <button
              type="submit"
              style={{ background: "#7C3AED", color: "#fff", border: "none", borderRadius: 8, padding: "10px 0", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
            >
              Prihlásiť sa
            </button>
          </form>
        </div>
      </div>
    );
  }

  const shops = await getAllFeaturedFromRedis();
  const now = new Date().toISOString().split("T")[0];

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "40px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
          <a href="/" style={{ color: "#7C3AED", textDecoration: "none", fontSize: 13 }}>← Späť na web</a>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>⭐ Správa featured obchodov</h1>
        </div>

        {params.error && (
          <div style={{ background: "#fee2e2", color: "#dc2626", padding: "12px 16px", borderRadius: 8, fontSize: 13, marginBottom: 20 }}>
            {params.error === "missing" ? "Vyplň všetky polia." : params.error === "exists" ? "Obchod s týmto slugom už existuje." : "Chyba."}
          </div>
        )}

        {/* Current list */}
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", marginBottom: 28, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", fontWeight: 700, fontSize: 14 }}>
            Zoznam obchodov ({shops.length})
          </div>
          {shops.length === 0 ? (
            <div style={{ padding: "24px 20px", color: "#888", fontSize: 14 }}>Žiadne obchody.</div>
          ) : shops.map(shop => {
            const isActive = shop.featured && shop.featuredUntil >= now;
            return (
              <div key={shop.slug} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderBottom: "1px solid #f3f4f6" }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: shop.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 18, flexShrink: 0 }}>
                  {shop.name[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{shop.name} <span style={{ color: "#888", fontWeight: 400, fontSize: 12 }}>/{shop.slug}</span></div>
                  <div style={{ color: "#555", fontSize: 12, marginTop: 2 }}>{shop.promoText}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                    <span style={{ background: "#f3e8ff", color: "#7C3AED", padding: "2px 8px", borderRadius: 4, fontSize: 11 }}>{shop.topDeal}</span>
                    <span style={{ background: "#f1f5f9", color: "#475569", padding: "2px 8px", borderRadius: 4, fontSize: 11 }}>do {shop.featuredUntil}</span>
                    {isActive
                      ? <span style={{ background: "#dcfce7", color: "#16a34a", padding: "2px 8px", borderRadius: 4, fontSize: 11 }}>aktívny</span>
                      : <span style={{ background: "#fee2e2", color: "#dc2626", padding: "2px 8px", borderRadius: 4, fontSize: 11 }}>neaktívny</span>
                    }
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <form action={toggleShop}>
                    <input type="hidden" name="slug" value={shop.slug} />
                    <button type="submit" style={{ background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontSize: 12 }}>
                      {shop.featured ? "Deaktivovať" : "Aktivovať"}
                    </button>
                  </form>
                  <form action={removeShop}>
                    <input type="hidden" name="slug" value={shop.slug} />
                    <button type="submit" style={{ background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontSize: 12 }}>
                      Odstrániť
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add new shop */}
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", fontWeight: 700, fontSize: 14 }}>
            Pridať obchod
          </div>
          <form action={addShop} style={{ padding: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#555" }}>Názov *</span>
              <input name="name" placeholder="napr. Alza" required style={inputStyle} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#555" }}>Slug * (URL)</span>
              <input name="slug" placeholder="napr. alza" required style={inputStyle} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#555" }}>Farba (hex)</span>
              <input name="color" placeholder="#7C3AED" defaultValue="#7C3AED" style={inputStyle} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#555" }}>Top deal *</span>
              <input name="topDeal" placeholder="napr. až 20% zľava" required style={inputStyle} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "1/-1" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#555" }}>Promo text *</span>
              <input name="promoText" placeholder="Krátky popis obchodu..." required style={inputStyle} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#555" }}>Aktívny do *</span>
              <input name="featuredUntil" type="date" required style={inputStyle} />
            </label>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button type="submit" style={{ background: "#7C3AED", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer", width: "100%" }}>
                Pridať obchod
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "9px 12px", borderRadius: 8, border: "1px solid #d1d5db",
  fontSize: 13, fontFamily: "system-ui, sans-serif", outline: "none",
};
