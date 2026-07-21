import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getArticleBySlug, saveArticle, type Article } from "@/lib/articles";
import { normalizeShopSlug } from "@/lib/slug";
import { getShopDomain } from "@/lib/shop-domains";

const SESSION_COOKIE = "admin_session";

export const metadata = { title: "Admin – Nový článok" };

function slugify(s: string): string {
  return s.toLowerCase()
    .replace(/[áä]/g, "a").replace(/[čć]/g, "c").replace(/[ď]/g, "d").replace(/[éě]/g, "e")
    .replace(/[í]/g, "i").replace(/[ľĺ]/g, "l").replace(/[ňń]/g, "n").replace(/[óô]/g, "o")
    .replace(/[řŕ]/g, "r").replace(/[šś]/g, "s").replace(/[ťţ]/g, "t").replace(/[úůü]/g, "u")
    .replace(/[ýÿ]/g, "y").replace(/[žź]/g, "z")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function createArticle(formData: FormData) {
  "use server";
  const cookieStore = await cookies();
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  if (!adminPassword || cookieStore.get(SESSION_COOKIE)?.value !== adminPassword) redirect("/admin");

  const title = (formData.get("title") as string || "").trim();
  const perex = (formData.get("perex") as string || "").trim();
  const content = (formData.get("content") as string || "").trim();
  const imageUrl = (formData.get("imageUrl") as string || "").trim();
  const shopName = (formData.get("shopName") as string || "").trim();

  if (!title || !perex) redirect("/admin/clanky/novy?error=missing");

  let slug = slugify(title);
  if (await getArticleBySlug(slug)) slug = `${slug}-${Date.now().toString(36)}`;

  const nowIso = new Date().toISOString();
  const article: Article = {
    slug,
    type: "tip",
    title,
    perex,
    content: content || undefined,
    imageUrl: imageUrl || undefined,
    shopName: shopName || undefined,
    domain: shopName ? (getShopDomain(shopName) || undefined) : undefined,
    shopSlug: shopName ? normalizeShopSlug(shopName) : undefined,
    date: nowIso,
    updatedAt: nowIso,
    published: true,
    source: "manual",
  };
  await saveArticle(article);
  redirect("/admin/clanky");
}

export default async function AdminNovyClanokPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const cookieStore = await cookies();
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  if (!adminPassword || cookieStore.get(SESSION_COOKIE)?.value !== adminPassword) redirect("/admin");
  const { error } = await searchParams;

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #e8e8e8", padding: "0 32px", height: 56, display: "flex", alignItems: "center", gap: 12 }}>
        <a href="/admin/clanky" style={{ color: "#22C55E", textDecoration: "none", fontSize: 13 }}>← Články</a>
        <span style={{ fontWeight: 700, fontSize: 16 }}>Nový článok</span>
      </div>

      <div style={{ maxWidth: 720, margin: "28px auto", padding: "0 24px" }}>
        {error && (
          <div style={{ background: "#fee2e2", color: "#dc2626", padding: "12px 16px", borderRadius: 8, fontSize: 13, marginBottom: 20 }}>
            Vyplň aspoň titul a perex.
          </div>
        )}
        <form action={createArticle} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e8e8", padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          <label style={lbl}>Titul *
            <input name="title" required placeholder="napr. 5 tipov ako ušetriť na elektronike" style={inputStyle} />
          </label>
          <label style={lbl}>Perex * (krátky popis / meta description)
            <textarea name="perex" required rows={2} style={{ ...inputStyle, resize: "vertical" }} />
          </label>
          <label style={lbl}>Obrázok URL
            <input name="imageUrl" placeholder="https://..." style={inputStyle} />
          </label>
          <label style={lbl}>Obchod (voliteľné — zobrazí odkaz na kupóny obchodu)
            <input name="shopName" placeholder="napr. Alza" style={inputStyle} />
          </label>
          <label style={lbl}>Obsah (HTML)
            <textarea name="content" rows={12} placeholder="<p>Text článku...</p>" style={{ ...inputStyle, resize: "vertical", fontFamily: "monospace" }} />
          </label>
          <button type="submit" style={{ background: "#22C55E", color: "#fff", border: "none", borderRadius: 8, padding: "12px 0", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
            Uložiť článok
          </button>
        </form>
      </div>
    </div>
  );
}

const lbl: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: "#555", display: "flex", flexDirection: "column", gap: 6 };
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db",
  fontSize: 14, fontFamily: "system-ui, sans-serif", outline: "none", boxSizing: "border-box",
};
