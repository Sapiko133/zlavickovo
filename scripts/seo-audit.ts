/**
 * SEO audit (finálny test) — crawl sitemap + kľúčových šablón a report problémov.
 *
 * Spustenie:
 *   npx tsx scripts/seo-audit.ts                          # produkcia
 *   npx tsx scripts/seo-audit.ts http://localhost:3000    # lokálny `next start`
 *   npx tsx scripts/seo-audit.ts <base> --json out.json   # plný report do súboru
 *
 * Exit 1 pri akejkoľvek chybe (severity "error") — použiteľné v CI.
 */
import * as fs from "fs";
import { runSeoAudit } from "../lib/seo/audit";
import { SEO_AUDIT_EXTRA_PATHS } from "../lib/seo/audit-paths";

async function main() {
  const args = process.argv.slice(2);
  const base = args.find((a) => /^https?:\/\//.test(a)) ?? "https://www.zlavickovo.sk";
  const jsonIdx = args.indexOf("--json");
  const jsonOut = jsonIdx >= 0 ? args[jsonIdx + 1] : null;

  console.log(`SEO audit: ${base}`);
  let last = 0;
  const report = await runSeoAudit({
    base,
    extraPaths: SEO_AUDIT_EXTRA_PATHS,
    concurrency: Number(process.env.SEO_AUDIT_CONCURRENCY ?? 6),
    onProgress: (d, t) => {
      const pct = Math.floor((d / t) * 10);
      if (pct !== last) { last = pct; process.stdout.write(`  ${d}/${t}\n`); }
    },
  });

  console.log("\n── Súhrn ──");
  for (const [k, v] of Object.entries(report.summary)) console.log(`  ${k.padEnd(24)} ${v}`);

  const byCode = new Map<string, typeof report.issues>();
  for (const i of report.issues) byCode.set(i.code, [...(byCode.get(i.code) ?? []), i]);
  console.log("\n── Problémy podľa typu ──");
  for (const [code, list] of byCode) {
    console.log(`\n[${list[0].severity.toUpperCase()}] ${code} (${list.length})`);
    for (const i of list.slice(0, 8)) console.log(`   ${i.url}  ${i.detail}`);
    if (list.length > 8) console.log(`   … +${list.length - 8}`);
  }

  if (jsonOut) {
    fs.writeFileSync(jsonOut, JSON.stringify(report, null, 2));
    console.log(`\nReport: ${jsonOut}`);
  }
  process.exit(report.summary.errors > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
