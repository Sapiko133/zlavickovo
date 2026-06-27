import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getShops } from "@/lib/dognet";

const SESSION_COOKIE = "admin_session";

export default async function AdminObchodyPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  if (!adminPassword || session !== adminPassword) redirect("/admin");

  let shops: any[] = [];
  try { shops = await getShops(); } catch {}

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #e8e8e8", padding: "0 32px", height: 56, display: "flex", alignItems: "center", gap: 12 }}>
        <a href="/admin" style={{ color: "#22C55E", textDecoration: "none", fontSize: 13 }}>← Admin</a>
        <span style={{ fontWeight: 700, fontSize: 16 }}>🏪 Obchody</span>
        <a href="/admin/featured" style={{ marginLeft: "auto", fontSize: 13, color: "#22C55E", textDecoration: "none" }}>⭐ Featured obchody →</a>
      </div>
      <div style={{ maxWidth: 1000, margin: "24px auto", padding: "0 24px" }}>
        <div style={{ marginBottom: 12, fontSize: 13, color: "#666" }}>Celkom: <strong>{shops.length}</strong> obchodov z Dognet</div>

        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e8e8", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e8e8e8" }}>
                <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 700, color: "#555" }}>Obchod</th>
                <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 700, color: "#555" }}>Kupóny</th>
                <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 700, color: "#555" }}>Akcie</th>
              </tr>
            </thead>
            <tbody>
              {shops.map((s: any, i: number) => {
                const slug = s.name.toLowerCase().replace(/\s+/g, "-");
                return (
                  <tr key={i} style={{ borderBottom: "1px solid #f5f5f5" }}>
                    <td style={{ padding: "10px 16px", fontWeight: 600, color: "#1d1d1f" }}>{s.name}</td>
                    <td style={{ padding: "10px 16px" }}>
                      {s.count > 0 ? (
                        <span style={{ fontWeight: 700, color: "#22C55E" }}>{s.count}</span>
                      ) : <span style={{ color: "#aaa" }}>0</span>}
                    </td>
                    <td style={{ padding: "10px 16px" }}>
                      <a href={`/kupony/${slug}`} style={{ color: "#22C55E", fontSize: 12, textDecoration: "none" }}>Zobraziť stránku →</a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
