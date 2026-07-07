/**
 * Audit logovania vyhľadávacích dopytov — číta priamo z Redis (Upstash) a
 * vypíše top 50 najhľadanejších výrazov + rozpad na okná 24h / 7d / 30d.
 *
 * Read-only: nič nezapisuje, takže funguje aj s read-only lokálnym tokenom.
 *
 * Spustenie: npx tsx scripts/audit-search-stats.ts
 */
import fs from "fs";
import path from "path";

// .env.local — splitovať /\r?\n/ (CRLF na Windows)
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function main() {
  const { getSearchStats } = await import("../lib/search-log");
  const TOP = 50;

  const stats = await getSearchStats(Math.max(TOP, 100));
  const { last24h, last7d, last30d } = stats.windows;

  const fmtTs = (ts: number | null) =>
    ts == null ? "—" : new Date(ts).toISOString().replace("T", " ").slice(0, 16);

  console.log(`\n=== Audit vyhľadávaní (${new Date(stats.generatedAt).toISOString()}) ===`);
  console.log(`Počet unikátnych dopytov:  24h=${last24h.length}  7d=${last7d.length}  30d=${last30d.length}`);

  console.log(`\n--- TOP ${TOP} za posledných 30 dní ---`);
  if (last30d.length === 0) {
    console.log("  (žiadne zalogované dopyty — feature práve nasadená, dáta pribudnú po vyhľadávaniach)");
  } else {
    console.log("  #    počet   posledné (UTC)     dopyt");
    last30d.slice(0, TOP).forEach((r, i) => {
      const rank = String(i + 1).padStart(3, " ");
      const cnt = String(r.count).padStart(6, " ");
      console.log(`  ${rank}  ${cnt}   ${fmtTs(r.lastSeen)}   ${r.query}`);
    });
  }

  const line = (label: string, rows: { query: string; count: number }[]) =>
    console.log(`  ${label.padEnd(6)} ${rows.slice(0, 10).map((r) => `${r.query}(${r.count})`).join(", ") || "—"}`);

  console.log(`\n--- Top 10 podľa okna ---`);
  line("24h:", last24h);
  line("7d:", last7d);
  line("30d:", last30d);
  console.log("");
}

main().catch((e) => {
  console.error("Audit zlyhal:", e);
  process.exit(1);
});
