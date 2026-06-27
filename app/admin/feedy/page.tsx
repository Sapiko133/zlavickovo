import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { redis } from "@/lib/redis";

const SESSION_COOKIE = "admin_session";
const FEEDS_KEY = "feeds:config";

interface FeedConfig {
  id: string;
  name: string;
  provider: "awin" | "dognet" | "cj";
  url: string;
  format: "xml" | "csv";
  active: boolean;
  lastImport?: string;
}

async function saveFeed(formData: FormData) {
  "use server";
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  if (!adminPassword || session !== adminPassword) redirect("/admin");

  const feeds: FeedConfig[] = ((await redis.get<FeedConfig[]>(FEEDS_KEY)) || []);

  const editId = formData.get("edit_id") as string | null;
  const newFeed: FeedConfig = {
    id: editId || Date.now().toString(),
    name: (formData.get("name") as string).trim(),
    provider: formData.get("provider") as "awin" | "dognet" | "cj",
    url: (formData.get("url") as string).trim(),
    format: formData.get("format") as "xml" | "csv",
    active: formData.get("active") === "on",
  };

  if (editId) {
    const idx = feeds.findIndex(f => f.id === editId);
    if (idx >= 0) feeds[idx] = { ...feeds[idx], ...newFeed };
    else feeds.push(newFeed);
  } else {
    feeds.push(newFeed);
  }

  await redis.set(FEEDS_KEY, feeds);
  redirect("/admin/feedy?saved=1");
}

async function deleteFeed(formData: FormData) {
  "use server";
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  if (!adminPassword || session !== adminPassword) redirect("/admin");

  const id = formData.get("id") as string;
  const feeds: FeedConfig[] = ((await redis.get<FeedConfig[]>(FEEDS_KEY)) || []);
  await redis.set(FEEDS_KEY, feeds.filter(f => f.id !== id));
  redirect("/admin/feedy?deleted=1");
}

async function toggleFeed(formData: FormData) {
  "use server";
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  if (!adminPassword || session !== adminPassword) redirect("/admin");

  const id = formData.get("id") as string;
  const feeds: FeedConfig[] = ((await redis.get<FeedConfig[]>(FEEDS_KEY)) || []);
  const idx = feeds.findIndex(f => f.id === id);
  if (idx >= 0) feeds[idx].active = !feeds[idx].active;
  await redis.set(FEEDS_KEY, feeds);
  redirect("/admin/feedy");
}

export default async function AdminFeedyPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  if (!adminPassword || session !== adminPassword) redirect("/admin");

  const sp = await searchParams;
  const feeds: FeedConfig[] = ((await redis.get<FeedConfig[]>(FEEDS_KEY)) || []);

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #e8e8e8", padding: "0 32px", height: 56, display: "flex", alignItems: "center", gap: 12 }}>
        <a href="/admin" style={{ color: "#22C55E", textDecoration: "none", fontSize: 13 }}>← Admin</a>
        <span style={{ fontWeight: 700, fontSize: 16 }}>📡 Feed Management</span>
      </div>

      <div style={{ maxWidth: 1000, margin: "24px auto", padding: "0 24px" }}>

        {sp.saved && <div style={{ marginBottom: 16, padding: "12px 16px", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, color: "#16A34A", fontSize: 14 }}>✓ Feed uložený.</div>}
        {sp.deleted && <div style={{ marginBottom: 16, padding: "12px 16px", background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 8, color: "#DC2626", fontSize: 14 }}>Feed vymazaný.</div>}

        {/* Add feed form */}
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e8e8", padding: "24px", marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 20px" }}>Pridať nový feed</h2>
          <form action={saveFeed} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 4 }}>Názov *</label>
              <input name="name" required placeholder="Napr. AWIN Zalando SK" style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #e8e8e8", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 4 }}>Provider *</label>
              <select name="provider" style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #e8e8e8", fontSize: 13, fontFamily: "inherit", cursor: "pointer" }}>
                <option value="awin">AWIN</option>
                <option value="dognet">Dognet</option>
                <option value="cj">CJ</option>
              </select>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 4 }}>URL feedu *</label>
              <input name="url" required placeholder="https://feed.awin.com/..." style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #e8e8e8", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 4 }}>Formát</label>
              <select name="format" style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #e8e8e8", fontSize: 13, fontFamily: "inherit", cursor: "pointer" }}>
                <option value="xml">XML</option>
                <option value="csv">CSV</option>
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 20 }}>
              <input type="checkbox" name="active" id="active" defaultChecked style={{ cursor: "pointer" }} />
              <label htmlFor="active" style={{ fontSize: 13, color: "#444", cursor: "pointer" }}>Aktívny</label>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <button type="submit" style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: "#22C55E", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
                💾 Uložiť feed
              </button>
            </div>
          </form>
        </div>

        {/* Feeds list */}
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e8e8", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #e8e8e8", fontWeight: 700, fontSize: 15 }}>
            Zoznam feedov ({feeds.length})
          </div>
          {feeds.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#aaa", fontSize: 14 }}>
              Zatiaľ žiadne feedy. Pridajte prvý feed vyššie.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e8e8e8" }}>
                  <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 700, color: "#555" }}>Názov</th>
                  <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 700, color: "#555" }}>Provider</th>
                  <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 700, color: "#555" }}>URL</th>
                  <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 700, color: "#555" }}>Formát</th>
                  <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 700, color: "#555" }}>Aktívny</th>
                  <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 700, color: "#555" }}>Posledný import</th>
                  <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 700, color: "#555" }}>Akcie</th>
                </tr>
              </thead>
              <tbody>
                {feeds.map((f, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f5f5f5" }}>
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: "#1d1d1f" }}>{f.name}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 100, background: f.provider === "awin" ? "#fff7ed" : f.provider === "cj" ? "#fdf4ff" : "#dbeafe", color: f.provider === "awin" ? "#ea580c" : f.provider === "cj" ? "#9333ea" : "#1d4ed8" }}>
                        {f.provider.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <a href={f.url} target="_blank" rel="noopener noreferrer" style={{ color: "#666", fontSize: 11, textDecoration: "none" }}>{f.url}</a>
                    </td>
                    <td style={{ padding: "12px 16px", color: "#666" }}>{f.format.toUpperCase()}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <form action={toggleFeed}>
                        <input type="hidden" name="id" value={f.id} />
                        <button type="submit" style={{ padding: "4px 10px", borderRadius: 20, border: "none", background: f.active ? "#dcfce7" : "#fee2e2", color: f.active ? "#16a34a" : "#dc2626", fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                          {f.active ? "✓ Aktívny" : "✕ Neaktívny"}
                        </button>
                      </form>
                    </td>
                    <td style={{ padding: "12px 16px", color: "#aaa", fontSize: 11 }}>
                      {f.lastImport ? new Date(f.lastImport).toLocaleDateString("sk-SK") : "Nikdy"}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <a href={`/api/cron/import-feeds?id=${f.id}`} style={{ padding: "4px 10px", borderRadius: 6, background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#16A34A", fontSize: 11, fontWeight: 700, textDecoration: "none" }}>▶ Import</a>
                        <form action={deleteFeed} style={{ display: "inline" }}>
                          <input type="hidden" name="id" value={f.id} />
                          <button type="submit" style={{ padding: "4px 10px", borderRadius: 6, background: "#FEF2F2", border: "1px solid #FCA5A5", color: "#DC2626", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>🗑 Vymazať</button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ marginTop: 16, padding: "14px 16px", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 10, fontSize: 13, color: "#16A34A" }}>
          💡 Automatický import prebieha každých 24 hodín cez Vercel Cron (<code>/api/cron/import-feeds</code>).
        </div>
      </div>
    </div>
  );
}
