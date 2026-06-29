import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const SESSION_COOKIE = "admin_session";

async function login(formData: FormData) {
  "use server";
  const password = formData.get("password") as string;
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  if (!adminPassword || password !== adminPassword) redirect("/admin?error=1");
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, adminPassword, { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 8, path: "/" });
  redirect("/admin");
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  const isAuth = adminPassword && session === adminPassword;
  const { error } = await searchParams;

  if (!isAuth) {
    return (
      <div style={{ minHeight: "100vh", background: "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: "40px 48px", border: "1px solid #e8e8e8", boxShadow: "0 4px 24px rgba(0,0,0,0.06)", width: 360 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "#22C55E", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900 }}>Z</div>
            <span style={{ fontWeight: 800, fontSize: 18, color: "#1d1d1f" }}>Admin</span>
          </div>
          {error && <div style={{ marginBottom: 16, padding: "10px 14px", background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 8, fontSize: 13, color: "#DC2626" }}>Nesprávne heslo.</div>}
          <form action={login}>
            <input name="password" type="password" placeholder="Admin heslo" autoFocus required style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: "1.5px solid #e8e8e8", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit", marginBottom: 12 }} />
            <button type="submit" style={{ width: "100%", padding: "12px", borderRadius: 8, border: "none", background: "#22C55E", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>
              Prihlásiť sa
            </button>
          </form>
        </div>
      </div>
    );
  }

  const SECTIONS = [
    { href: "/admin/featured",  icon: "⭐", title: "Featured obchody", desc: "Správa odporúčaných obchodov na hlavnej stránke" },
    { href: "/admin/kupony",    icon: "🏷️", title: "Kupóny",           desc: "Prehľad aktívnych kupónov z Dognet a Affial" },
    { href: "/admin/letaky",    icon: "🗞️", title: "Letáky",           desc: "Správa a prehľad letákov" },
    { href: "/admin/obchody",   icon: "🏪", title: "Obchody",          desc: "Zoznam všetkých obchodov" },
    { href: "/admin/feedy",     icon: "📡", title: "Feed provideri",   desc: "AWIN, Dognet, CJ — správa produktových feedov" },
    { href: "/admin/cache",     icon: "🗄️", title: "Cache",            desc: "Prehľad a mazanie Redis cache" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "system-ui, sans-serif" }}>
      <style>{`
        .admin-card { transition: border-color 0.15s, box-shadow 0.15s; }
        .admin-card:hover { border-color: #22C55E !important; box-shadow: 0 4px 16px rgba(34,197,94,0.12) !important; }
      `}</style>
      <div style={{ background: "#fff", borderBottom: "1px solid #e8e8e8", padding: "0 32px", height: 56, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 28, height: 28, borderRadius: 7, background: "#22C55E", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900 }}>Z</div>
        <span style={{ fontWeight: 700, fontSize: 16 }}>Zlavickovo Admin</span>
        <span style={{ marginLeft: "auto", fontSize: 13, color: "#aaa" }}>
          <a href="/" style={{ color: "#22C55E", textDecoration: "none" }}>← Web</a>
        </span>
      </div>
      <div style={{ maxWidth: 900, margin: "40px auto", padding: "0 24px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 24px" }}>Dashboard</h1>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 14 }}>
          {SECTIONS.map(s => (
            <a key={s.href} href={s.href} className="admin-card" style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "20px", background: "#fff", borderRadius: 12, border: "1.5px solid #e8e8e8", textDecoration: "none", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
            >
              <span style={{ fontSize: 28, flexShrink: 0 }}>{s.icon}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#1d1d1f", marginBottom: 4 }}>{s.title}</div>
                <div style={{ fontSize: 12, color: "#888", lineHeight: 1.4 }}>{s.desc}</div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
