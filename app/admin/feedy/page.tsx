import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getFeedProviderHealth } from "@/lib/feeds/health";
import ProviderHealthCard from "./ProviderHealthCard";

const SESSION_COOKIE = "admin_session";

export const dynamic = "force-dynamic";

export default async function AdminFeedyPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  if (!adminPassword || session !== adminPassword) redirect("/admin");

  const health = await getFeedProviderHealth().catch((reason) => ({
    error: reason instanceof Error ? reason.message : String(reason),
  }));
  const providerHealth = Array.isArray(health) ? health : [];
  const healthError = Array.isArray(health) ? null : health.error;

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "system-ui, sans-serif" }}>
      <style>{`
        .feed-admin-header {
          align-items: center;
          background: #fff;
          border-bottom: 1px solid #e8e8e8;
          display: flex;
          gap: 12px;
          min-height: 56px;
          padding: 0 32px;
        }
        @media (max-width: 640px) {
          .feed-admin-header { padding: 12px 20px; }
          .feed-page-container { padding-left: 20px !important; padding-right: 20px !important; }
        }
      `}</style>
      <div className="feed-admin-header">
        <a href="/admin" style={{ color: "#22C55E", textDecoration: "none", fontSize: 13 }}>← Admin</a>
        <span style={{ fontWeight: 700, fontSize: 16 }}>📡 Zdroje kupónov</span>
      </div>

      <div className="feed-page-container" style={{ maxWidth: 1000, margin: "24px auto", padding: "0 24px" }}>
        <section aria-labelledby="provider-health-title" style={{ marginBottom: 24 }}>
          <div style={{ marginBottom: 12 }}>
            <h1 id="provider-health-title" style={{ color: "#0f172a", fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", margin: 0 }}>
              Stav zdrojov kupónov
            </h1>
            <p style={{ color: "#64748b", fontSize: 13, lineHeight: 1.5, margin: "5px 0 0" }}>
              Dognet, eHub, CJ a Affial. Nula znamená skutočne prečítanú prázdnu cache; chýbajúci kľúč
              alebo chyba sa zobrazujú samostatne.
            </p>
          </div>

          {healthError ? (
            <div role="alert" style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, color: "#991b1b", fontSize: 13, marginBottom: 12, padding: "12px 14px" }}>
              Diagnostiku sa nepodarilo načítať: {healthError}
            </div>
          ) : null}

          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))" }}>
            {providerHealth.map((provider) => <ProviderHealthCard key={provider.id} provider={provider} />)}
          </div>
        </section>
      </div>
    </div>
  );
}
