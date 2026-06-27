import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCoupons } from "@/lib/dognet";
import { getAffialCoupons } from "@/lib/affial";

const SESSION_COOKIE = "admin_session";

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
  try { dognetCoupons = await getCoupons(); } catch {}
  try { affialCoupons = await getAffialCoupons(); } catch {}

  const allCoupons = [
    ...dognetCoupons.map((c: any) => ({ ...c, _source: "Dognet" })),
    ...affialCoupons.map((c: any) => ({ ...c, _source: "Affial" })),
  ];

  const filtered = allCoupons
    .filter(c => sourceFilter === "all" || c._source.toLowerCase() === sourceFilter)
    .filter(c => !shopFilter || (c.campaign?.name || c.campaign_name || "").toLowerCase().includes(shopFilter));

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "system-ui, sans-serif" }}>
      {adminHeader("🏷️ Kupóny")}
      <div style={{ maxWidth: 1100, margin: "24px auto", padding: "0 24px" }}>

        {/* Filters */}
        <form style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <select name="source" defaultValue={sourceFilter} onChange={(e: any) => { const u = new URL(window.location.href); u.searchParams.set("source", e.target.value); window.location.href = u.toString(); }}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e8e8e8", fontSize: 13, fontFamily: "inherit", cursor: "pointer" }}>
            <option value="all">Všetky zdroje</option>
            <option value="dognet">Dognet</option>
            <option value="affial">Affial</option>
          </select>
          <input name="shop" defaultValue={sp.shop || ""} placeholder="Filter obchod..." style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e8e8e8", fontSize: 13, fontFamily: "inherit", minWidth: 180 }} />
          <button type="submit" style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#22C55E", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            Filtrovať
          </button>
        </form>

        <div style={{ marginBottom: 12, fontSize: 13, color: "#666" }}>
          Celkom: <strong>{filtered.length}</strong> kupónov (Dognet: {dognetCoupons.length}, Affial: {affialCoupons.length})
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
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 100, background: c._source === "Dognet" ? "#dbeafe" : "#f0fdf4", color: c._source === "Dognet" ? "#1d4ed8" : "#16a34a" }}>
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
