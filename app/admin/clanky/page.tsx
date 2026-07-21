import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAllArticles, getArticleBySlug, saveArticle, deleteArticle } from "@/lib/articles";

const SESSION_COOKIE = "admin_session";

export const metadata = { title: "Admin – Články" };

async function requireAuth() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  if (!adminPassword || session !== adminPassword) redirect("/admin");
}

async function toggleArticle(formData: FormData) {
  "use server";
  await requireAuth();
  const slug = formData.get("slug") as string;
  const a = await getArticleBySlug(slug);
  if (a) await saveArticle({ ...a, published: !a.published, updatedAt: new Date().toISOString() });
  redirect("/admin/clanky");
}

async function updateArticle(formData: FormData) {
  "use server";
  await requireAuth();
  const slug = formData.get("slug") as string;
  const a = await getArticleBySlug(slug);
  if (a) {
    await saveArticle({
      ...a,
      title: ((formData.get("title") as string) || a.title).trim(),
      perex: ((formData.get("perex") as string) || a.perex).trim(),
      imageUrl: ((formData.get("imageUrl") as string) || "").trim() || undefined,
      updatedAt: new Date().toISOString(),
    });
  }
  redirect("/admin/clanky");
}

async function removeArticle(formData: FormData) {
  "use server";
  await requireAuth();
  const slug = formData.get("slug") as string;
  await deleteArticle(slug);
  redirect("/admin/clanky");
}

export default async function AdminClankyPage() {
  await requireAuth();
  const articles = await getAllArticles();

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #e8e8e8", padding: "0 32px", height: 56, display: "flex", alignItems: "center", gap: 12 }}>
        <a href="/admin" style={{ color: "#22C55E", textDecoration: "none", fontSize: 13 }}>← Admin</a>
        <span style={{ fontWeight: 700, fontSize: 16 }}>📝 Články</span>
        <a href="/admin/clanky/novy" style={{ marginLeft: "auto", background: "#22C55E", color: "#fff", textDecoration: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700 }}>
          + Nový článok
        </a>
      </div>

      <div style={{ maxWidth: 900, margin: "28px auto", padding: "0 24px" }}>
        <div style={{ marginBottom: 14, fontSize: 13, color: "#666" }}>
          Celkom <strong>{articles.length}</strong> článkov
        </div>

        {articles.length === 0 && (
          <div style={{ padding: "40px", textAlign: "center", color: "#999", background: "#fff", borderRadius: 12, border: "1px solid #e8e8e8" }}>
            Žiadne články. Vygenerujú sa automaticky (cron) alebo pridaj manuálny.
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {articles.map((a) => (
            <div key={a.slug} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e8e8", padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 100, background: a.type === "sale" ? "#fff7ed" : "#f0fdf4", color: a.type === "sale" ? "#ea580c" : "#16a34a" }}>
                  {a.type === "sale" ? "Výpredaj" : "Tip"}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 100, background: "#f1f5f9", color: "#475569" }}>{a.source}</span>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 100, background: a.published ? "#dcfce7" : "#fee2e2", color: a.published ? "#16a34a" : "#dc2626" }}>
                  {a.published ? "publikovaný" : "skrytý"}
                </span>
                <a href={`/blog/${a.slug}`} target="_blank" rel="noreferrer" style={{ marginLeft: "auto", fontSize: 12, color: "#22C55E", textDecoration: "none" }}>/blog/{a.slug} ↗</a>
              </div>

              <form action={updateArticle} style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
                <input type="hidden" name="slug" value={a.slug} />
                <label style={{ fontSize: 12, fontWeight: 600, color: "#555" }}>Titul
                  <input name="title" defaultValue={a.title} style={inputStyle} />
                </label>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#555" }}>Perex
                  <textarea name="perex" defaultValue={a.perex} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
                </label>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#555" }}>Obrázok URL
                  <input name="imageUrl" defaultValue={a.imageUrl || ""} placeholder="https://..." style={inputStyle} />
                </label>
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button type="submit" style={btn("#22C55E")}>Uložiť</button>
                </div>
              </form>

              <div style={{ display: "flex", gap: 8, marginTop: 10, paddingTop: 10, borderTop: "1px solid #f3f4f6" }}>
                <form action={toggleArticle}>
                  <input type="hidden" name="slug" value={a.slug} />
                  <button type="submit" style={btn("#475569", "#f1f5f9")}>{a.published ? "Skryť" : "Publikovať"}</button>
                </form>
                <form action={removeArticle}>
                  <input type="hidden" name="slug" value={a.slug} />
                  <button type="submit" style={btn("#dc2626", "#fee2e2")}>Odstrániť</button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db",
  fontSize: 13, fontFamily: "system-ui, sans-serif", outline: "none", marginTop: 4, boxSizing: "border-box",
};
function btn(color: string, bg = "transparent"): React.CSSProperties {
  return { background: bg === "transparent" ? color : bg, color: bg === "transparent" ? "#fff" : color, border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
}
