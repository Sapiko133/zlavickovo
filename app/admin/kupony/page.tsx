import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCoupons } from "@/lib/dognet";
import { getAffialCoupons } from "@/lib/affial";
import { getEhubCoupons } from "@/lib/ehub";
import {
  getAllManualCoupons,
  saveManualCoupon,
  deleteManualCoupon,
  newManualCouponId,
  type ManualCoupon,
} from "@/lib/manual-coupons";
import { normalizeShopSlug } from "@/lib/slug";

const SESSION_COOKIE = "admin_session";

async function addManualCoupon(formData: FormData) {
  "use server";
  const cookieStore = await cookies();
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  if (!adminPassword || cookieStore.get(SESSION_COOKIE)?.value !== adminPassword) redirect("/admin");

  const shopName = (formData.get("shopName") as string || "").trim();
  const code = (formData.get("code") as string || "").trim();
  const title = (formData.get("title") as string || "").trim();
  if (!shopName || !title) redirect("/admin/kupony?error=missing");

  const shopSlug = normalizeShopSlug(shopName);
  const c: ManualCoupon = {
    id: newManualCouponId(shopSlug),
    shopName,
    shopSlug,
    code,
    title,
    discount: (formData.get("discount") as string || "").trim() || undefined,
    url: (formData.get("url") as string || "").trim(),
    validTo: (formData.get("validTo") as string || "").trim() || null,
    createdAt: new Date().toISOString(),
  };
  await saveManualCoupon(c);
  redirect("/admin/kupony");
}

async function removeManualCoupon(formData: FormData) {
  "use server";
  const cookieStore = await cookies();
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  if (!adminPassword || cookieStore.get(SESSION_COOKIE)?.value !== adminPassword) redirect("/admin");
  await deleteManualCoupon(formData.get("id") as string);
  redirect("/admin/kupony");
}

const mcInput: React.CSSProperties = {
  padding: "9px 12px", borderRadius: 8, border: "1px solid #d1d5db",
  fontSize: 13, fontFamily: "system-ui, sans-serif", outline: "none", boxSizing: "border-box",
};

function adminHeader(title: string) {
  return (
    <div style={{ background: "#fff", borderBottom: "1px solid #e8e8e8", padding: "0 32px", height: 56, display: "flex", alignItems: "center", gap: 12 }}>
      <a href="/admin" style={{ color: "#22C55E", textDecoration: "none", fontSize: 13 }}>← Admin</a>
      <span style={{ fontWeight: 700, fontSize: 16 }}>{title}</span>
    </div>
  );
}

export default async function AdminKuponyPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  if (!adminPassword || session !== adminPassword) redirect("/admin");

  const sp = await searchParams;
  const sourceFilter = sp.source || "all";
  const shopFilter = (sp.shop || "").toLowerCase();

  let dognetCoupons: any[] = [];
  let affialCoupons: any[] = [];
  let ehubCoupons: any[] = [];
  try { dognetCoupons = await getCoupons(); } catch {}
  try { affialCoupons = await getAffialCoupons(); } catch {}
  try { ehubCoupons = await getEhubCoupons(); } catch {}
  const manualCoupons = await getAllManualCoupons();

  const allCoupons = [
    ...dognetCoupons.map((c: any) => ({ ...c, _source: "Dognet" })),
    ...affialCoupons.map((c: any) => ({ ...c, _source: "Affial" })),
    ...ehubCoupons.map((c: any) => ({ ...c, _source: "eHub" })),
  ];

  const filtered = allCoupons
    .filter(c => sourceFilter === "all" || c._source.toLowerCase() === sourceFilter)
    .filter(c => !shopFilter || (c.campaign?.name || c.campaign_name || "").toLowerCase().includes(shopFilter));

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "system-ui, sans-serif" }}>
      {adminHeader("🏷️ Kupóny")}
      <div style={{ maxWidth: 1100, margin: "24px auto", padding: "0 24px" }}>

        {/* Manuálne kupóny */}
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e8e8", marginBottom: 24, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid #e8e8e8", fontWeight: 700, fontSize: 14 }}>
            ✍️ Manuálne kupóny ({manualCoupons.length})
          </div>
          {manualCoupons.map((c) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderBottom: "1px solid #f3f4f6" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{c.shopName} <span style={{ color: "#888", fontWeight: 400 }}>— {c.title}</span></div>
                <div style={{ fontSize: 12, color: "#666", marginTop: 2, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {c.code && <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#22C55E", background: "#F0FDF4", padding: "1px 6px", borderRadius: 4 }}>{c.code}</span>}
                  {c.discount && <span>{c.discount}</span>}
                  {c.validTo && <span>do {new Date(c.validTo).toLocaleDateString("sk-SK")}</span>}
                </div>
              </div>
              <form action={removeManualCoupon}>
                <input type="hidden" name="id" value={c.id} />
                <button type="submit" style={{ background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontSize: 12 }}>Odstrániť</button>
              </form>
            </div>
          ))}
          <form action={addManualCoupon} style={{ padding: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <input name="shopName" placeholder="Obchod * (napr. Alza)" required style={mcInput} />
            <input name="code" placeholder="Kód (napr. LETO10)" style={mcInput} />
            <input name="title" placeholder="Názov ponuky * (napr. 10% na všetko)" required style={mcInput} />
            <input name="discount" placeholder="Zľava (napr. -10%)" style={mcInput} />
            <input name="url" placeholder="Affiliate/cieľová URL (https://...)" style={{ ...mcInput, gridColumn: "1/-1" }} />
            <input name="validTo" type="date" style={mcInput} />
            <button type="submit" style={{ background: "#22C55E", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              Pridať kupón
            </button>
          </form>
        </div>

        {/* Filters */}
        <form style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <select name="source" defaultValue={sourceFilter}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e8e8e8", fontSize: 13, fontFamily: "inherit", cursor: "pointer" }}>
            <option value="all">Všetky zdroje</option>
            <option value="dognet">Dognet</option>
            <option value="affial">Affial</option>
            <option value="ehub">eHub</option>
          </select>
          <input name="shop" defaultValue={sp.shop || ""} placeholder="Filter obchod..." style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e8e8e8", fontSize: 13, fontFamily: "inherit", minWidth: 180 }} />
          <button type="submit" style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#22C55E", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            Filtrovať
          </button>
        </form>

        <div style={{ marginBottom: 12, fontSize: 13, color: "#666" }}>
          Celkom: <strong>{filtered.length}</strong> kupónov (Dognet: {dognetCoupons.length}, Affial: {affialCoupons.length}, eHub: {ehubCoupons.length})
        </div>

        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e8e8", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e8e8e8" }}>
                <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 700, color: "#555" }}>Obchod</th>
                <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 700, color: "#555" }}>Názov</th>
                <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 700, color: "#555" }}>Kód</th>
                <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 700, color: "#555" }}>Zdroj</th>
                <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 700, color: "#555" }}>Platný do</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map((c: any, i: number) => (
                <tr key={i} style={{ borderBottom: "1px solid #f5f5f5" }}>
                  <td style={{ padding: "10px 16px", fontWeight: 600, color: "#1d1d1f" }}>{c.campaign?.name || c.campaign_name || "—"}</td>
                  <td style={{ padding: "10px 16px", color: "#444", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title || c.name || "—"}</td>
                  <td style={{ padding: "10px 16px" }}>
                    {c.code ? (
                      <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#22C55E", background: "#F0FDF4", padding: "2px 8px", borderRadius: 4 }}>{c.code}</span>
                    ) : <span style={{ color: "#aaa" }}>—</span>}
                  </td>
                  <td style={{ padding: "10px 16px" }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 100,
                      background: c._source === "Dognet" ? "#dbeafe" : c._source === "eHub" ? "#fff3e0" : "#f0fdf4",
                      color: c._source === "Dognet" ? "#1d4ed8" : c._source === "eHub" ? "#FF6B35" : "#16a34a",
                    }}>
                      {c._source}
                    </span>
                  </td>
                  <td style={{ padding: "10px 16px", color: "#666", fontSize: 12 }}>
                    {c.valid_to ? new Date(c.valid_to).toLocaleDateString("sk-SK") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 100 && (
            <div style={{ padding: "12px 16px", fontSize: 12, color: "#aaa", textAlign: "center", borderTop: "1px solid #f5f5f5" }}>
              Zobrazených 100 z {filtered.length} kupónov
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
