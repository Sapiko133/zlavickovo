import { redirect } from "next/navigation";
import { isAdminSession } from "@/lib/auth";
import { getOpsOverview, type FeedRow } from "@/lib/ops/overview";
import type { JobRun } from "@/lib/jobs/log";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const COLORS = { ok: "#16A34A", warning: "#D97706", error: "#DC2626", disabled: "#6B7280", never: "#6B7280", skipped: "#6B7280" } as const;

function ago(iso?: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms)) return "—";
  const future = ms < 0;
  const m = Math.round(Math.abs(ms) / 60_000);
  const txt = m < 60 ? `${m} min` : m < 48 * 60 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`;
  return future ? `o ${txt}` : `pred ${txt}`;
}

function fmt(iso?: string | null): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toLocaleString("sk-SK", { timeZone: "Europe/Bratislava", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
}

function Badge({ status }: { status: keyof typeof COLORS | string }) {
  const color = COLORS[status as keyof typeof COLORS] ?? "#6B7280";
  return <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, color: "#fff", background: color }}>{status}</span>;
}

const card: React.CSSProperties = { background: "#fff", borderRadius: 12, border: "1px solid #e8e8e8", padding: 16, overflowX: "auto" };
const th: React.CSSProperties = { textAlign: "left", padding: "6px 8px", fontSize: 12, color: "#6B7280", fontWeight: 600, borderBottom: "1px solid #eee", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "6px 8px", fontSize: 13, borderBottom: "1px solid #f3f3f3", verticalAlign: "top" };

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: "bad" | "warn" }) {
  const color = tone === "bad" ? "#DC2626" : tone === "warn" ? "#D97706" : "#1d1d1f";
  return (
    <div style={{ minWidth: 110 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 12, color: "#6B7280" }}>{label}</div>
    </div>
  );
}

function FeedTable({ feeds }: { feeds: FeedRow[] }) {
  return (
    <table style={{ borderCollapse: "collapse", width: "100%" }}>
      <thead>
        <tr>
          {["Feed", "Stav", "Posledný sync", "Ďalší sync", "Interval", "Položky", "Nové", "Zmenené", "Odstránené", "Chyba"].map((h) => <th key={h} style={th}>{h}</th>)}
        </tr>
      </thead>
      <tbody>
        {feeds.map((f) => (
          <tr key={f.id}>
            <td style={td}><strong>{f.label}</strong><div style={{ fontSize: 11, color: "#9CA3AF" }}>{f.id} · {f.tier}</div></td>
            <td style={td}><Badge status={f.health} />{f.consecutiveErrors ? <div style={{ fontSize: 11, color: "#DC2626" }}>{f.consecutiveErrors}× po sebe</div> : null}</td>
            <td style={td}>{ago(f.lastSuccessAt)}<div style={{ fontSize: 11, color: "#9CA3AF" }}>{fmt(f.lastSuccessAt)}</div></td>
            <td style={td}>{ago(f.nextDueAt)}</td>
            <td style={td}>{Math.round((f.intervalMin ?? f.baseIntervalMin) / 60 * 10) / 10} h</td>
            <td style={td}>{f.lastSuccessItemCount ?? "—"}</td>
            <td style={td}>{f.lastNewCount ?? "—"}</td>
            <td style={td}>{f.lastUpdatedCount ?? "—"}</td>
            <td style={td}>{f.lastRemovedCount ?? "—"}</td>
            <td style={{ ...td, maxWidth: 320, color: "#991B1B", fontSize: 12 }}>
              {f.pendingDrop ? `Podozrivý pokles → ${f.pendingDrop.count} (${f.pendingDrop.seen}/3). ` : ""}
              {f.lastError ?? ""}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function JobTable({ runs }: { runs: JobRun[] }) {
  return (
    <table style={{ borderCollapse: "collapse", width: "100%" }}>
      <thead>
        <tr>{["Čas", "Job", "Spúšťač", "Stav", "Trvanie", "Počty", "Chyba"].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
      </thead>
      <tbody>
        {runs.map((r) => (
          <tr key={r.id}>
            <td style={{ ...td, whiteSpace: "nowrap" }}>{fmt(r.startedAt)}</td>
            <td style={td}>{r.job}</td>
            <td style={{ ...td, fontSize: 11, color: "#6B7280" }}>{r.trigger}</td>
            <td style={td}><Badge status={r.status} /></td>
            <td style={td}>{(r.durationMs / 1000).toFixed(1)} s</td>
            <td style={{ ...td, fontSize: 11, color: "#374151" }}>{Object.entries(r.counts).map(([k, v]) => `${k}=${v}`).join(" · ")}</td>
            <td style={{ ...td, fontSize: 12, color: "#991B1B", maxWidth: 300 }}>{r.error ?? ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function AdminOpsPage({ searchParams }: { searchParams: Promise<{ ran?: string; error?: string }> }) {
  if (!(await isAdminSession())) redirect("/admin");
  const { ran, error } = await searchParams;
  const o = await getOpsOverview();
  const fb = "error" in o.facebook ? null : o.facebook;
  const seo = "error" in o.seo ? null : o.seo;
  const a = o.offers.articles;

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "system-ui, sans-serif", color: "#1d1d1f" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #e8e8e8", padding: "10px 16px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
        <a href="/admin" style={{ color: "#22C55E", textDecoration: "none", fontSize: 13 }}>← Admin</a>
        <span style={{ fontWeight: 700, fontSize: 16 }}>⚙️ Operations</span>
        <span style={{ fontSize: 12, color: "#6B7280" }}>{fmt(o.generatedAt)}</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <form action="/api/admin/ops" method="post"><input type="hidden" name="action" value="tick" />
            <button type="submit" style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#22C55E", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Spustiť tick</button>
          </form>
          <form action="/api/admin/ops" method="post"><input type="hidden" name="action" value="tick-force" />
            <button type="submit" style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #22C55E", background: "#fff", color: "#16A34A", fontWeight: 700, cursor: "pointer" }}>Vynútiť všetky feedy</button>
          </form>
          <a href="/api/admin/ops?action=tick-dry" style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #e8e8e8", fontSize: 13, color: "#374151", textDecoration: "none" }}>Dry-run tick (JSON)</a>
          <a href="/api/admin/ops?action=fb-dry" style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #e8e8e8", fontSize: 13, color: "#374151", textDecoration: "none" }}>Facebook dry-run (JSON)</a>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: "20px auto", padding: "0 16px", display: "flex", flexDirection: "column", gap: 16 }}>
        {ran && <div style={{ ...card, borderColor: "#86EFAC", background: "#F0FDF4" }}>Tick dokončený: {ran}</div>}
        {error && <div style={{ ...card, borderColor: "#FCA5A5", background: "#FEF2F2", color: "#991B1B" }}>Chyba: {error}</div>}

        {/* ALERTY — najdôležitejšie hore */}
        <section style={{ ...card, borderColor: o.alerts.some((x) => x.level === "critical") ? "#FCA5A5" : o.alerts.length ? "#FCD34D" : "#86EFAC" }}>
          <h2 style={{ margin: "0 0 8px", fontSize: 15 }}>🚨 Alerty ({o.alerts.length})</h2>
          {o.alerts.length === 0 ? <div style={{ color: "#16A34A", fontSize: 14 }}>Všetko v poriadku — žiadne aktívne alerty.</div> : (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {o.alerts.map((x) => (
                <li key={x.key} style={{ fontSize: 14, marginBottom: 4 }}>
                  <Badge status={x.level === "critical" ? "error" : "warning"} /> {x.message} <span style={{ fontSize: 11, color: "#9CA3AF" }}>od {fmt(x.firstAt)} · {x.count}×{x.notifiedAt ? " · notifikované" : ""}</span>
                </li>
              ))}
            </ul>
          )}
          {o.resolvedAlerts.length > 0 && (
            <details style={{ marginTop: 8 }}><summary style={{ fontSize: 12, color: "#6B7280", cursor: "pointer" }}>Vyriešené ({o.resolvedAlerts.length})</summary>
              <ul style={{ fontSize: 12, color: "#6B7280" }}>{o.resolvedAlerts.map((x, i) => <li key={i}>{fmt(x.resolvedAt)} — {x.message}</li>)}</ul>
            </details>
          )}
        </section>

        <section style={card}>
          <h2 style={{ margin: "0 0 8px", fontSize: 15 }}>📡 Feedy</h2>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 12 }}>
            <Stat label="OK" value={o.feeds.filter((f) => f.health === "ok").length} />
            <Stat label="Warning" value={o.feeds.filter((f) => f.health === "warning").length} tone={o.feeds.some((f) => f.health === "warning") ? "warn" : undefined} />
            <Stat label="Error" value={o.feeds.filter((f) => f.health === "error").length} tone={o.feeds.some((f) => f.health === "error") ? "bad" : undefined} />
            <Stat label="Nenakonfigurované" value={o.feeds.filter((f) => f.health === "disabled").length} />
          </div>
          <FeedTable feeds={o.feeds} />
        </section>

        <section style={card}>
          <h2 style={{ margin: "0 0 8px", fontSize: 15 }}>🏷️ Ponuky</h2>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <Stat label="Aktívne akcie" value={a.active} />
            <Stat label="Stale (grace)" value={a.stale} tone={a.stale ? "warn" : undefined} />
            <Stat label="Ukončené (noindex)" value={a.expired} />
            <Stat label="Odstránené (308)" value={a.removed} />
            <Stat label="Duplicitné" value={a.duplicates} tone={a.duplicates ? "warn" : undefined} />
            <Stat label="Bez stránky obchodu" value={a.orphans.length} tone={a.orphans.length ? "warn" : undefined} />
            {Object.entries(o.offers.coupons).map(([k, v]) => <Stat key={k} label={`Kupóny ${k} (aktívne/spolu)`} value={`${v.active}/${v.total}`} />)}
          </div>
          {a.orphans.length > 0 && <details style={{ marginTop: 8 }}><summary style={{ fontSize: 12, cursor: "pointer" }}>Akcie bez stránky obchodu</summary><ul style={{ fontSize: 12 }}>{a.orphans.map((u) => <li key={u}><a href={u}>{u}</a></li>)}</ul></details>}
        </section>

        <section style={card}>
          <h2 style={{ margin: "0 0 8px", fontSize: 15 }}>📣 Facebook</h2>
          {!fb ? <div style={{ color: "#991B1B" }}>Chyba: {"error" in o.facebook ? o.facebook.error : ""}</div> : (
            <>
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 8 }}>
                <Stat label="Kandidáti" value={fb.candidates} />
                <Stat label="Naplánované" value={fb.stats.scheduled + fb.stats.publishing} />
                <Stat label="Publikované" value={fb.stats.published} />
                <Stat label="Zlyhané" value={fb.stats.failed} tone={fb.stats.failed ? "bad" : undefined} />
                <Stat label="Preskočené" value={fb.stats.skipped} />
                <Stat label="Postov/deň" value={fb.config.postsPerDay} />
              </div>
              <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 8 }}>
                {fb.config.enabled ? "Meta API nakonfigurované" : "⚠️ Chýba FACEBOOK_PAGE_ID / FACEBOOK_PAGE_ACCESS_TOKEN"}{fb.config.dryRun ? " · FACEBOOK_DRY_RUN=1 (nepublikuje)" : ""} · sloty {fb.config.slots.join(", ")}
              </div>
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead><tr>{["Plán", "Obchod", "Stav", "Šablóna", "Text"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {[...fb.upcoming, ...fb.recent].map((i) => (
                    <tr key={i.id}>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>{fmt(i.scheduledAt)}{i.publishedAt ? <div style={{ fontSize: 11, color: "#16A34A" }}>✓ {fmt(i.publishedAt)}</div> : null}</td>
                      <td style={td}><a href={`/akcie/${i.slug}`}>{i.shopName}</a></td>
                      <td style={td}><Badge status={i.status === "published" ? "ok" : i.status === "failed" ? "error" : i.status === "skipped" ? "skipped" : "warning"} /> <span style={{ fontSize: 11 }}>{i.status}</span>{i.error ? <div style={{ fontSize: 11, color: "#991B1B" }}>{i.error}</div> : null}</td>
                      <td style={{ ...td, fontSize: 11, color: "#6B7280" }}>{i.templateId}</td>
                      <td style={{ ...td, fontSize: 12, whiteSpace: "pre-line", maxWidth: 480 }}>{i.text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </section>

        <section style={card}>
          <h2 style={{ margin: "0 0 8px", fontSize: 15 }}>🔎 SEO <a href="/admin/seo" style={{ fontSize: 12, color: "#16A34A", fontWeight: 400 }}>detail →</a></h2>
          {!seo ? <div style={{ color: "#991B1B" }}>Chyba: {"error" in o.seo ? o.seo.error : ""}</div> : (
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              <Stat label="Indexovateľné obchody" value={seo.shops.indexable} />
              <Stat label="Noindex obchody" value={seo.shops.noindex} />
              {Object.entries(seo.sitemap).map(([k, v]) => <Stat key={k} label={`Sitemap ${k}`} value={v} tone={v < 0 ? "bad" : undefined} />)}
              <Stat label="Obchody bez ponuky" value={seo.shopsWithoutOffers} />
              <Stat label="Kategórie bez ponuky" value={seo.categoriesWithoutOffers.length} tone={seo.categoriesWithoutOffers.length ? "warn" : undefined} />
              <Stat label="Publikované, ale ukončené" value={seo.offers.publishedButExpired.length} tone={seo.offers.publishedButExpired.length ? "warn" : undefined} />
            </div>
          )}
        </section>

        <section style={card}>
          <h2 style={{ margin: "0 0 8px", fontSize: 15 }}>🔗 Affiliate odkazy (cieľové URL)</h2>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 8 }}>
            <Stat label="Skontrolované" value={o.links.total} />
            <Stat label="OK" value={o.links.ok} />
            <Stat label="Varovanie" value={o.links.warn} tone={o.links.warn ? "warn" : undefined} />
            <Stat label="Mŕtve" value={o.links.dead} tone={o.links.dead ? "bad" : undefined} />
          </div>
          {o.links.deadSample.length > 0 && (
            <ul style={{ fontSize: 12, margin: 0, paddingLeft: 18 }}>
              {o.links.deadSample.map((l) => <li key={l.url}><Badge status={l.status === "dead" ? "error" : "warning"} /> {l.url} — {l.error} ({l.consecutiveFailures}×)</li>)}
            </ul>
          )}
        </section>

        <section style={card}>
          <h2 style={{ margin: "0 0 8px", fontSize: 15 }}>🕒 História jobov (čo sa kedy stalo)</h2>
          <JobTable runs={o.recentJobs} />
        </section>
      </div>
    </div>
  );
}
