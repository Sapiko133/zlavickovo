import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { redis } from "@/lib/redis";
import { feedManager } from "@/lib/feeds/FeedManager";
import { getCustomFeeds } from "@/lib/feeds/AffialDiscovery";
import AffialFeedSection from "./AffialFeedSection";

const SESSION_COOKIE = "admin_session";
const FEEDS_KEY = "feeds:config";

interface FeedConfig {
  id: string;
  name: string;
  provider: "awin" | "dognet" | "cj" | "affial" | "ehub";
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
    provider: formData.get("provider") as FeedConfig["provider"],
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

const PROVIDER_COLORS: Record<string, { bg: string; text: string }> = {
  awin:   { bg: "#fff7ed", text: "#ea580c" },
  dognet: { bg: "#dbeafe", text: "#1d4ed8" },
  affial: { bg: "#f0fdf4", text: "#16a34a" },
  ehub:   { bg: "#fff3e0", text: "#FF6B35" },
  cj:     { bg: "#fdf4ff", text: "#9333ea" },
};

export default async function AdminFeedyPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  if (!adminPassword || session !== adminPassword) redirect("/admin");

  const sp = await searchParams;
  const [feeds, stats, customAffialFeeds] = await Promise.allSettled([
    redis.get<FeedConfig[]>(FEEDS_KEY),
    feedManager.getStats(),
    getCustomFeeds(),
  ]);

  const feedList: FeedConfig[] = (feeds.status === "fulfilled" ? feeds.value : null) ?? [];
  const feedStats = stats.status === "fulfilled" ? stats.value : null;
  const lastImport = feedStats?.lastImport;
  const affialCustomFeeds = (customAffialFeeds.status === "fulfilled" ? customAffialFeeds.value : null) ?? [];
  const hasLoginCredentials = !!(process.env.AFFIAL_EMAIL && process.env.AFFIAL_PASSWORD);

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #e8e8e8", padding: "0 32px", height: 56, display: "flex", alignItems: "center", gap: 12 }}>
        <a href="/admin" style={{ color: "#22C55E", textDecoration: "none", fontSize: 13 }}>← Admin</a>
        <span style={{ fontWeight: 700, fontSize: 16 }}>📡 Feed Management</span>
        <div style={{ marginLeft: "auto" }}>
          <a
            href="/api/cron/import-feeds?trigger=admin"
            target="_blank"
            rel="noopener noreferrer"
            style={{ padding: "8px 18px", borderRadius: 8, background: "#22C55E", color: "#fff", fontWeight: 700, fontSize: 13, textDecoration: "none" }}
          >
            ▶ Importovať teraz
          </a>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: "24px auto", padding: "0 24px" }}>

        {sp.saved && <div style={{ marginBottom: 16, padding: "12px 16px", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, color: "#16A34A", fontSize: 14 }}>✓ Feed uložený.</div>}
        {sp.deleted && <div style={{ marginBottom: 16, padding: "12px 16px", background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 8, color: "#DC2626", fontSize: 14 }}>Feed vymazaný.</div>}

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 24 }}>
          {[
            { label: "Dognet", count: feedStats?.dognet ?? 0, color: "#1d4ed8", bg: "#dbeafe" },
            { label: "Affial", count: feedStats?.affial ?? 0, color: "#16a34a", bg: "#f0fdf4" },
            { label: "eHub", count: feedStats?.ehub ?? 0, color: "#FF6B35", bg: "#fff3e0" },
            { label: "CJ", count: feedStats?.cj ?? 0, color: "#9333ea", bg: "#fdf4ff" },
            {
              label: "Posl. import",
              count: lastImport ? new Date(lastImport.timestamp).toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" }) : "–",
              sub: lastImport ? new Date(lastImport.timestamp).toLocaleDateString("sk-SK") : "nikdy",
              color: "#555",
              bg: "#f9fafb",
            },
          ].map((s, i) => (
            <div key={i} style={{ background: "#fff", border: "1px solid #e8e8e8", borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#999", marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.count}</div>
              {"sub" in s && s.sub && <div style={{ fontSize: 11, color: "#aaa" }}>{s.sub}</div>}
              {"sub" in s ? null : <div style={{ fontSize: 11, color: "#aaa" }}>produktov</div>}
            </div>
          ))}
        </div>

        {/* Add feed form */}
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e8e8", padding: "24px", marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 20px" }}>Pridať vlastný feed</h2>
          <form action={saveFeed} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 4 }}>Názov *</label>
              <input name="name" required placeholder="Napr. Dognet — Zalando SK" style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #e8e8e8", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 4 }}>Provider *</label>
              <select name="provider" style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #e8e8e8", fontSize: 13, fontFamily: "inherit", cursor: "pointer" }}>
                <option value="dognet">Dognet</option>
                <option value="affial">Affial</option>
                <option value="ehub">eHub</option>
                <option value="awin">AWIN</option>
                <option value="cj">CJ</option>
              </select>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 4 }}>URL feedu *</label>
              <input name="url" required placeholder="https://..." style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #e8e8e8", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }} />
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
            Vlastné feedy ({feedList.length})
          </div>
          {feedList.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#aaa", fontSize: 14 }}>
              Zatiaľ žiadne vlastné feedy. Pridajte prvý feed vyššie.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e8e8e8" }}>
                  <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 700, color: "#555" }}>Názov</th>
                  <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 700, color: "#555" }}>Provider</th>
                  <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 700, color: "#555" }}>URL</th>
                  <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 700, color: "#555" }}>Aktívny</th>
                  <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 700, color: "#555" }}>Posl. import</th>
                  <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 700, color: "#555" }}>Akcie</th>
                </tr>
              </thead>
              <tbody>
                {feedList.map((f, i) => {
                  const pc = PROVIDER_COLORS[f.provider] ?? { bg: "#f5f5f5", text: "#555" };
                  return (
                    <tr key={i} style={{ borderBottom: "1px solid #f5f5f5" }}>
                      <td style={{ padding: "12px 16px", fontWeight: 600, color: "#1d1d1f" }}>{f.name}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 100, background: pc.bg, color: pc.text }}>
                          {f.provider.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <a href={f.url} target="_blank" rel="noopener noreferrer" style={{ color: "#666", fontSize: 11, textDecoration: "none" }}>{f.url}</a>
                      </td>
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
                        <form action={deleteFeed} style={{ display: "inline" }}>
                          <input type="hidden" name="id" value={f.id} />
                          <button type="submit" style={{ padding: "4px 10px", borderRadius: 6, background: "#FEF2F2", border: "1px solid #FCA5A5", color: "#DC2626", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>🗑 Vymazať</button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ marginTop: 16, padding: "14px 16px", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 10, fontSize: 13, color: "#16A34A" }}>
          💡 Automatický import prebieha každých 6 hodín cez Vercel Cron (<code>/api/cron/import-feeds</code>).
          Zahrňuje Dognet, Affial (37 feedov) a eHub (5 datadepo feedov).
        </div>

        <AffialFeedSection
          initialFeeds={affialCustomFeeds}
          hasLoginCredentials={hasLoginCredentials}
        />
      </div>
    </div>
  );
}
