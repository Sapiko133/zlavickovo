import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLastSeoReport, getSeoInventory } from "@/lib/seo/health";
import type { AuditIssue } from "@/lib/seo/audit";

export const dynamic = "force-dynamic";

const SESSION_COOKIE = "admin_session";

const LABELS: Record<string, string> = {
  crawled: "Prelezené URL",
  sitemapUrls: "URL v sitemap",
  indexable: "Indexovateľné",
  noindex: "Noindex",
  status404: "404 / 410",
  redirects: "Presmerovania",
  errors: "Chyby",
  warnings: "Varovania",
  missingTitle: "Chýba title",
  duplicateTitles: "Duplicitné title",
  duplicateDescriptions: "Duplicitné description",
  missingH1: "Chýba H1",
  canonicalMismatch: "Canonical nesúlad",
  sitemapErrors: "Chyby sitemap",
  brokenLinks: "Nefunkčné interné odkazy",
  redirectChains: "Reťaze presmerovaní",
  orphanPages: "Osirelé stránky",
  thinPages: "Thin stránky",
  expiredIndexed: "Ukončené ponuky v indexe",
  structuredDataErrors: "Chyby structured data",
};

const CODE_HINT: Record<string, string> = {
  broken_internal_link: "Odkaz vedie na 404 — resolvuj slug cez lib/seo/shop-registry.",
  duplicate_title: "Title musí byť unikátny v rámci indexovateľných stránok.",
  orphan_page: "URL je v sitemap, ale žiadna stránka naň neodkazuje.",
  sitemap_noindex: "Sitemap obsahuje noindex URL — politika v lib/seo/indexing.ts sa rozišla.",
  sitemap_404: "Sitemap obsahuje neexistujúcu URL.",
  structured_data: "Nevalidný JSON-LD uzol (lib/seo/jsonld.ts).",
  expired_indexed: "Ukončená akcia bez noindex.",
  thin_page: "Málo viditeľného obsahu.",
};

function sevColor(sev: AuditIssue["severity"]) {
  return sev === "error" ? "#DC2626" : sev === "warning" ? "#D97706" : "#6B7280";
}

export default async function AdminSeoPage({ searchParams }: { searchParams: Promise<{ done?: string; error?: string }> }) {
  const cookieStore = await cookies();
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  if (!adminPassword || cookieStore.get(SESSION_COOKIE)?.value !== adminPassword) redirect("/admin");
  const { done, error } = await searchParams;

  const [inventory, report] = await Promise.all([
    getSeoInventory().catch(() => null),
    getLastSeoReport(),
  ]);

  const groups = new Map<string, AuditIssue[]>();
  for (const i of report?.issues ?? []) groups.set(i.code, [...(groups.get(i.code) ?? []), i]);

  const card: React.CSSProperties = { background: "#fff", borderRadius: 12, border: "1px solid #e8e8e8", padding: 16 };

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "system-ui, sans-serif", color: "#1d1d1f" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #e8e8e8", padding: "0 24px", height: 56, display: "flex", alignItems: "center", gap: 12 }}>
        <a href="/admin" style={{ color: "#22C55E", textDecoration: "none", fontSize: 13 }}>← Admin</a>
        <span style={{ fontWeight: 700, fontSize: 16 }}>🔎 SEO health</span>
        <form action="/api/admin/seo-health" method="post" style={{ marginLeft: "auto" }}>
          <button type="submit" style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#22C55E", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
            Spustiť crawl audit (2–4 min)
          </button>
        </form>
      </div>

      <div style={{ maxWidth: 1200, margin: "24px auto", padding: "0 24px", display: "flex", flexDirection: "column", gap: 20 }}>
        {done && <div style={{ ...card, borderColor: "#86EFAC", background: "#F0FDF4" }}>Audit dokončený.</div>}
        {error && <div style={{ ...card, borderColor: "#FCA5A5", background: "#FEF2F2", color: "#991B1B" }}>Chyba auditu: {error}</div>}

        {/* Inventár z dát (vždy aktuálny) */}
        {inventory && (
          <section style={card}>
            <h2 style={{ fontSize: 16, margin: "0 0 12px" }}>Inventár z dát <span style={{ fontSize: 12, color: "#6B7280", fontWeight: 400 }}>{new Date(inventory.generatedAt).toLocaleString("sk-SK")}</span></h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 10 }}>
              {Object.entries(inventory.sitemap).map(([t, n]) => (
                <Stat key={t} label={`sitemap-${t}.xml`} value={n} />
              ))}
              <Stat label="Obchody spolu" value={inventory.shops.total} />
              <Stat label="Obchody indexovateľné" value={inventory.shops.indexable} />
              <Stat label="Obchody noindex (bez ponuky)" value={inventory.shops.noindex} />
              <Stat label="Akcie aktívne" value={inventory.offers.active} />
              <Stat label="Akcie ukončené (historické, noindex)" value={inventory.offers.expiredHistorical} />
              <Stat label="Akcie > 30 dní po konci (308)" value={inventory.offers.gone} />
              <Stat label="Publikované, ale ukončené" value={inventory.offers.publishedButExpired.length} warn={inventory.offers.publishedButExpired.length > 0} />
              <Stat label="Duplicitné akcie (canonical)" value={inventory.offers.duplicates.length} />
            </div>
            {inventory.offers.duplicates.length > 0 && (
              <details style={{ marginTop: 12 }}>
                <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Duplicitné akcie → canonical</summary>
                <ul style={{ fontSize: 12, margin: "8px 0 0" }}>
                  {inventory.offers.duplicates.map((d) => <li key={d.slug}><a href={d.slug}>{d.slug}</a> → <a href={d.canonical}>{d.canonical}</a></li>)}
                </ul>
              </details>
            )}
            {inventory.offers.publishedButExpired.length > 0 && (
              <details style={{ marginTop: 8 }}>
                <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Publikované, ale ukončené (zobrazené ako „Akcia skončila“, noindex)</summary>
                <ul style={{ fontSize: 12, margin: "8px 0 0" }}>
                  {inventory.offers.publishedButExpired.slice(0, 100).map((u) => <li key={u}><a href={u}>{u}</a></li>)}
                </ul>
              </details>
            )}
            <details style={{ marginTop: 8 }}>
              <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Obchody noindex (ukážka 50)</summary>
              <ul style={{ fontSize: 12, margin: "8px 0 0", columns: 3 }}>
                {inventory.shops.noindexSample.map((u) => <li key={u}><a href={u}>{u}</a></li>)}
              </ul>
            </details>
          </section>
        )}

        {/* Crawl report */}
        {!report ? (
          <section style={card}>Zatiaľ žiadny crawl report — spusti audit tlačidlom hore (alebo <code>npx tsx scripts/seo-audit.ts</code>).</section>
        ) : (
          <>
            <section style={card}>
              <h2 style={{ fontSize: 16, margin: "0 0 12px" }}>
                Crawl audit {report.base}{" "}
                <span style={{ fontSize: 12, color: "#6B7280", fontWeight: 400 }}>{new Date(report.finishedAt).toLocaleString("sk-SK")}</span>
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 10 }}>
                {Object.entries(report.summary).filter(([k]) => LABELS[k]).map(([k, v]) => (
                  <Stat key={k} label={LABELS[k]} value={v}
                    warn={v > 0 && !["crawled", "sitemapUrls", "indexable", "noindex", "redirects", "status404"].includes(k)} />
                ))}
              </div>
            </section>

            <section style={card}>
              <h2 style={{ fontSize: 16, margin: "0 0 12px" }}>URL na opravu</h2>
              {groups.size === 0 && <p style={{ fontSize: 14, color: "#16A34A" }}>Bez nálezov.</p>}
              {[...groups.entries()].map(([code, list]) => (
                <details key={code} open={list[0].severity === "error"} style={{ borderTop: "1px solid #F3F4F6", padding: "10px 0" }}>
                  <summary style={{ cursor: "pointer", fontSize: 14, fontWeight: 700 }}>
                    <span style={{ color: sevColor(list[0].severity) }}>[{list[0].severity}]</span> {code} ({list.length})
                    {CODE_HINT[code] && <span style={{ fontWeight: 400, color: "#6B7280", fontSize: 12 }}> — {CODE_HINT[code]}</span>}
                  </summary>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginTop: 8 }}>
                    <tbody>
                      {list.slice(0, 200).map((i, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid #F9FAFB" }}>
                          <td style={{ padding: "4px 8px", whiteSpace: "nowrap", verticalAlign: "top" }}><a href={i.url} target="_blank" rel="noopener">{i.url}</a></td>
                          <td style={{ padding: "4px 8px", color: "#4B5563" }}>{i.detail}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {list.length > 200 && <div style={{ fontSize: 12, color: "#6B7280" }}>… +{list.length - 200}</div>}
                </details>
              ))}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, warn = false }: { label: string; value: number; warn?: boolean }) {
  return (
    <div style={{ border: `1px solid ${warn ? "#FCA5A5" : "#E5E7EB"}`, background: warn ? "#FEF2F2" : "#F9FAFB", borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: warn ? "#B91C1C" : "#111827" }}>{value}</div>
      <div style={{ fontSize: 12, color: "#6B7280" }}>{label}</div>
    </div>
  );
}
