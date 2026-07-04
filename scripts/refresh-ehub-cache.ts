/**
 * Manuálny refresh eHub Redis cache (ehub:coupons:v2 + ehub:shops:v2).
 * Rovnaké fetch+filter funkcie ako cron /api/cron/refresh-affiliate-cache.
 *
 * Spustenie: npx tsx scripts/refresh-ehub-cache.ts
 */
import * as fs from "fs";
import * as path from "path";

async function main() {
  // .env.local — CRLF-safe split, load pred importom lib (Redis klient číta env)
  const envPath = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }

  const { refreshEhubCache, refreshEhubShopsCache } = await import("../lib/ehub");
  const coupons = await refreshEhubCache();
  console.log("ehub:coupons =>", JSON.stringify(coupons));
  const shops = await refreshEhubShopsCache();
  console.log("ehub:shops =>", JSON.stringify(shops));
  process.exit(0);
}

main().catch(e => {
  console.error("Refresh zlyhal:", e?.message ?? String(e));
  process.exit(1);
});
