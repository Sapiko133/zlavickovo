/**
 * Dry-run celej automatiky proti produkčným dátam — NIČ nezapisuje ani nepublikuje.
 * Feedy sa stiahnu a porovnajú so snapshotom, lifecycle akcií a Facebook plán sa
 * len vypočítajú. Spustenie: npx tsx scripts/automation-dry-run.ts [--fb-texts]
 */
import * as fs from "fs";
import * as path from "path";

async function main() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  const { runTick } = await import("../lib/automation/tick");
  const { runFacebookAutomation } = await import("../lib/social/facebook");
  const tick = await runTick({ trigger: "script:dry-run", dryRun: true, forceFeeds: "all" });
  console.log(JSON.stringify({ ...tick, articles: tick.articles }, null, 2));
  if (process.argv.includes("--fb-texts")) {
    const fb = await runFacebookAutomation({ dryRun: true, trigger: "script:dry-run" });
    for (const i of fb.plan.items) console.log(`\n--- ${i.scheduledAt} ${i.shopName} (score ${i.score}, ${i.templateId})\n${i.text}`);
    console.log("\nFB plan:", fb.plan.status, "kandidáti", fb.plan.candidates, "eligible", fb.plan.eligible, "skipped", JSON.stringify(fb.plan.skipped), "publish:", fb.publish.status);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("Dry-run zlyhal:", e?.message ?? String(e));
  process.exit(1);
});
