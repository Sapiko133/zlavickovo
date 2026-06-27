import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCashbackShops } from "@/lib/dognet";

const SESSION_COOKIE = "admin_session";

export default async function AdminCashbackPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  if (!adminPassword || session !== adminPassword) redirect("/admin");

  let shops: any[] = [];
  try { shops = await getCashbackShops(); } catch {}

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #e8e8e8", padding: "0 32px", height: 56, display: "flex", alignItems: "center", gap: 12 }}>
        <a href="/admin" style={{ color: "#22C55E", textDecoration: "none", fontSize: 13 }}>← Admin</a>
        <span style={{ fontWeight: 700, fontSize: 16 }}>💰 Cashback</span>
      </div>
      <div style={{ maxWidth: 900, margin: "24px auto", padding: "0 24px" }}>
        <div style={{ marginBottom: 12, fontSize: 13, color: "#666" }}>Celkom: <strong>{shops.length}</strong> cashback obchodov z Dognet</div>

        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e8e8", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e8e8e8" }}>
                <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 700, color: "#555" }}>Obchod</th>
                <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 700, color: "#555" }}>Cashback %</th>
                <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 700, color: "#555" }}>Affiliate link</th>
              </tr>
            </thead>
            <tbody>
              {shops.map((s: any, i: number) => (
                <tr key={i} style={{ borderBottom: "1px solid #f5f5f5" }}>
                  <td style={{ padding: "10px 16px", fontWeight: 600, color: "#1d1d1f" }}>{s.name}</td>
                  <td style={{ padding: "10px 16px" }}>
                    <span style={{ fontWeight: 700, color: "#16a34a" }}>{s.cashback || "—"}</span>
                  </td>
                  <td style={{ padding: "10px 16px" }}>
                    <a href={s.affiliate_link} target="_blank" rel="noopener noreferrer" style={{ color: "#22C55E", fontSize: 12, textDecoration: "none", wordBreak: "break-all" }}>
                      {s.affiliate_link ? s.affiliate_link.slice(0, 60) + "..." : "—"}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
