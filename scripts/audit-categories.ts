/**
 * Audit kategorizácie obchodov — reportuje, koľko obchodov má priradenú
 * kanonickú kategóriu (categoryId cez resolveCategory) a vypíše nezaradené
 * obchody podľa zdroja. Navyše ukáže pokrytie kupónov kategóriami.
 *
 * Spustenie: npx tsx scripts/audit-categories.ts
 */
import * as fs from "fs";
import * as path from "path";

async function main() {
  // Load .env.local (rovnaký pattern ako audit-shops.ts)
  const envPath = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, "utf-8")
      .split(/\r?\n/)
      .forEach(line => {
        const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      });
  }

  const { getShops } = await import("../lib/dognet");
  const { getEhubShops } = await import("../lib/ehub");
  const { getCjShops } = await import("../lib/cj");
  const { buildKnownShops } = await import("../lib/all-shops");
  const { getStaticShops, getStaticEhubShops, getStaticCoupons } = await import("../lib/static-data");
  const { resolveCategory } = await import("../lib/shop-categories");
  const { TAXONOMY } = await import("../lib/taxonomy");

  console.log("Načítavam zdroje (Dognet, eHub, CJ; fallback statické snapshoty)...");
  const [dognetLive, ehubLive, cj] = await Promise.all([
    getShops().catch(() => []),
    getEhubShops().catch(() => []),
    getCjShops().catch(() => []),
  ]);
  const dognet = dognetLive.length > 0 ? dognetLive : getStaticShops();
  const ehub = ehubLive.length > 0 ? ehubLive : getStaticEhubShops();

  const shops = buildKnownShops({ dognet, ehub, cj });

  // --- Pokrytie obchodov ---
  const byCat = new Map<string, number>();
  const unassigned: typeof shops = [];
  for (const s of shops) {
    if (s.categoryId) byCat.set(s.categoryId, (byCat.get(s.categoryId) ?? 0) + 1);
    else unassigned.push(s);
  }

  console.log("\n================ AUDIT KATEGÓRIÍ ================");
  console.log(`Obchodov spolu: ${shops.length}`);
  console.log(`Zaradených:     ${shops.length - unassigned.length}`);
  console.log(`Nezaradených:   ${unassigned.length}\n`);

  console.log("Obchody podľa kategórie:");
  for (const id of Object.keys(TAXONOMY)) {
    console.log(`  ${TAXONOMY[id as keyof typeof TAXONOMY].label.padEnd(12)} ${byCat.get(id) ?? 0}`);
  }

  // --- Pokrytie kupónov (statický snapshot Dognet) ---
  const coupons = getStaticCoupons();
  let couponsAssigned = 0;
  const couponsByCat = new Map<string, number>();
  for (const c of coupons) {
    const n = c.campaign?.name || c.campaign_name || "";
    const id = resolveCategory({ name: n, domain: n });
    if (id) {
      couponsAssigned++;
      couponsByCat.set(id, (couponsByCat.get(id) ?? 0) + 1);
    }
  }
  console.log(`\nKupóny (statický snapshot): ${coupons.length}, v kategórii: ${couponsAssigned}`);
  for (const [id, n] of [...couponsByCat.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${id.padEnd(12)} ${n}`);
  }

  // --- Nezaradené obchody podľa zdroja ---
  if (unassigned.length > 0) {
    console.log(`\n--- NEZARADENÉ OBCHODY (${unassigned.length}) ---`);
    const bySource = new Map<string, typeof shops>();
    for (const s of unassigned) {
      const arr = bySource.get(s.source) ?? [];
      arr.push(s);
      bySource.set(s.source, arr);
    }
    for (const [source, arr] of bySource) {
      console.log(`\n[${source}] (${arr.length}):`);
      for (const s of arr) {
        console.log(`  ${s.slug.padEnd(30)} ${s.name}${s.count ? `  (${s.count} kupónov)` : ""}`);
      }
    }
  } else {
    console.log("\n✅ Každý obchod má priradenú kategóriu.");
  }

  process.exit(0);
}

main().catch(e => {
  console.error("Audit zlyhal:", e?.message ?? String(e));
  process.exit(1);
});
