import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { redis } from "@/lib/redis";

const SESSION_COOKIE = "admin_session";

async function clearSearchCache() {
  "use server";
  try {
    // Zmaž všetky search_cache:* kľúče
    let cursor = 0;
    let deleted = 0;
    do {
      const [next, keys] = await (redis as any).scan(cursor, { match: "search_cache:*", count: 100 });
      cursor = Number(next);
      if (keys.length) {
        await redis.del(...keys);
        deleted += keys.length;
      }
    } while (cursor !== 0);
    redirect("/admin/cache?cleared=" + deleted);
  } catch {
    redirect("/admin/cache?error=1");
  }
}

export default async function AdminCachePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  if (!adminPassword || session !== adminPassword) redirect("/admin");

  const sp = await searchParams;

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #e8e8e8", padding: "0 32px", height: 56, display: "flex", alignItems: "center", gap: 12 }}>
        <a href="/admin" style={{ color: "#22C55E", textDecoration: "none", fontSize: 13 }}>← Admin</a>
        <span style={{ fontWeight: 700, fontSize: 16 }}>🗄️ Cache</span>
      </div>
      <div style={{ maxWidth: 700, margin: "40px auto", padding: "0 24px" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 20px" }}>Redis Cache</h1>

        {sp.cleared && <div style={{ marginBottom: 16, padding: "12px 16px", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, color: "#16A34A", fontSize: 14 }}>✓ Zmazaných {sp.cleared} cache záznamo(v).</div>}
        {sp.error && <div style={{ marginBottom: 16, padding: "12px 16px", background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 8, color: "#DC2626", fontSize: 14 }}>Chyba pri mazaní cache.</div>}

        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e8e8", padding: "24px" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 8px" }}>Search cache</h2>
          <p style={{ fontSize: 14, color: "#666", margin: "0 0 16px", lineHeight: 1.5 }}>
            Vyhľadávanie (search-v2) ukladá výsledky do Redis s kľúčom <code>search_cache:[md5]</code> na 30 dní. Ak chceš vynútiť nové vyhľadávanie, zmaž cache.
          </p>
          <form action={clearSearchCache}>
            <button type="submit" style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "#DC2626", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
              🗑️ Zmazať všetku search cache
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
