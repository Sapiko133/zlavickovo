import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LETAKY, getExpiryDate, formatDate } from "@/lib/letaky";

const SESSION_COOKIE = "admin_session";

export default async function AdminLetakyPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  if (!adminPassword || session !== adminPassword) redirect("/admin");

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #e8e8e8", padding: "0 32px", height: 56, display: "flex", alignItems: "center", gap: 12 }}>
        <a href="/admin" style={{ color: "#22C55E", textDecoration: "none", fontSize: 13 }}>← Admin</a>
        <span style={{ fontWeight: 700, fontSize: 16 }}>🗞️ Letáky</span>
      </div>
      <div style={{ maxWidth: 900, margin: "24px auto", padding: "0 24px" }}>
        <div style={{ marginBottom: 12, fontSize: 13, color: "#666" }}>Celkom: <strong>{LETAKY.length}</strong> letákov</div>

        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e8e8", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e8e8e8" }}>
                <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 700, color: "#555" }}>Obchod</th>
                <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 700, color: "#555" }}>Krajina</th>
                <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 700, color: "#555" }}>Platný do</th>
                <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 700, color: "#555" }}>Aktualizácia</th>
                <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 700, color: "#555" }}>Akcie</th>
              </tr>
            </thead>
            <tbody>
              {LETAKY.map((l, i) => {
                const expiry = getExpiryDate(l.newDayOfWeek);
                const expired = expiry < new Date();
                return (
                  <tr key={i} style={{ borderBottom: "1px solid #f5f5f5" }}>
                    <td style={{ padding: "10px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 7, background: l.color, display: "flex", alignItems: "center", justifyContent: "center", color: l.color === "#FFCC00" ? "#333" : "#fff", fontWeight: 800, fontSize: 12, flexShrink: 0 }}>{l.letter}</div>
                        <span style={{ fontWeight: 600, color: "#1d1d1f" }}>{l.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 16px" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 100, background: l.country === "sk" ? "#dbeafe" : "#fce7f3", color: l.country === "sk" ? "#1d4ed8" : "#be185d" }}>
                        {l.country.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: "10px 16px", color: expired ? "#dc2626" : "#16a34a", fontWeight: 600, fontSize: 12 }}>
                      {formatDate(expiry)}
                    </td>
                    <td style={{ padding: "10px 16px", color: "#666", fontSize: 12 }}>{l.updateText}</td>
                    <td style={{ padding: "10px 16px" }}>
                      <a href={`/letaky/${l.slug}`} style={{ color: "#22C55E", fontSize: 12, textDecoration: "none", marginRight: 10 }}>Zobraziť</a>
                      <a href={l.url} target="_blank" rel="noopener noreferrer" style={{ color: "#666", fontSize: 12, textDecoration: "none" }}>Leták ↗</a>
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
