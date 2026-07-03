/**
 * Audit obchodov — overuje, že každý obchod existujúci v dátach je dostupný
 * cez všetky 4 miesta, ktoré čítajú z getAllKnownShops() (lib/all-shops.ts):
 *   1. sitemap (indexovateľnosť)
 *   2. autocomplete
 *   3. shop stránka /kupony/[slug]
 *   4. /obchody
 *
 * Spustenie: npx tsx scripts/audit-shops.ts
 */
import * as fs from "fs";
import * as path from "path";

async function main() {
  // Load .env.local (rovnaký pattern ako generate-static-data.ts)
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
  const { AFFIAL_SHOPS } = await import("../lib/affial-shops");
  const { AFFIAL_COUPONS } = await import("../lib/affial-coupons");
  const { TOP_SHOPS } = await import("../lib/top-shops");
  const { buildKnownShops } = await import("../lib/all-shops");
  const { normalizeShopName, normalizeShopSlug } = await import("../lib/slug");

  console.log("Načítavam live zdroje (Dognet, eHub, CJ)...");
  const [dognet, ehub, cj] = await Promise.all([
    getShops().catch(() => []),
    getEhubShops().catch(() => []),
    getCjShops().catch(() => []),
  ]);

  const merged = buildKnownShops({ dognet, ehub, cj });

  // Mapy pre vyhľadanie, kam raw obchod dopadol
  const mergedBySlug = new Map(merged.map(s => [s.slug, s]));
  const mergedByNorm = new Map<string, (typeof merged)[number]>();
  for (const s of merged) {
    const n = normalizeShopName(s.name);
    if (n && !mergedByNorm.has(n)) mergedByNorm.set(n, s);
  }

  interface RawShop { name: string; slug: string; source: string }
  const raw: RawShop[] = [
    ...TOP_SHOPS.map(s => ({ name: s.name, slug: s.slug, source: "top" })),
    ...dognet.map((s: any) => ({ name: s.name, slug: normalizeShopSlug(s.name), source: "dognet" })),
    ...ehub.map(s => ({ name: s.name, slug: normalizeShopSlug(s.name), source: "ehub" })),
    ...cj.map(s => ({ name: s.advertiserName, slug: normalizeShopSlug(s.advertiserName), source: "cj" })),
    ...AFFIAL_SHOPS.map(s => ({ name: s.name, slug: normalizeShopSlug(s.name), source: "affial" })),
    ...AFFIAL_COUPONS.map(s => ({ name: s.shop, slug: normalizeShopSlug(s.shop), source: "affial-coupon" })),
  ];

  const ok: RawShop[] = [];
  const aliased: { raw: RawShop; into: string }[] = [];
  const missing: RawShop[] = [];

  const seenRaw = new Set<string>();
  for (const r of raw) {
    const key = `${r.source}|${r.slug}|${r.name.toLowerCase()}`;
    if (seenRaw.has(key)) continue; // duplicita v rámci zdroja (napr. 2 kupóny toho istého obchodu)
    seenRaw.add(key);

    if (!r.name?.trim() || !r.slug) { missing.push(r); continue; }

    const direct = mergedBySlug.get(r.slug);
    if (direct) { ok.push(r); continue; }

    const viaNorm = mergedByNorm.get(normalizeShopName(r.name));
    if (viaNorm) { aliased.push({ raw: r, into: `${viaNorm.name} (/kupony/${viaNorm.slug})` }); continue; }

    missing.push(r);
  }

  // Report
  const bySource = (arr: { source?: string; raw?: RawShop }[] | RawShop[], src: string) =>
    (arr as any[]).filter(x => (x.source ?? x.raw?.source) === src).length;

  console.log("\n================ AUDIT OBCHODOV ================");
  console.log(`Zlúčený zoznam (getAllKnownShops): ${merged.length} obchodov`);
  console.log("\nZdroje (raw záznamy po odstránení duplicít v zdroji):");
  for (const src of ["top", "dognet", "ehub", "cj", "affial", "affial-coupon"]) {
    const total = raw.filter(r => r.source === src).length;
    console.log(`  ${src.padEnd(14)} ${String(total).padStart(4)} | OK: ${bySource(ok, src)} | zlúčené: ${bySource(aliased, src)} | chýbajúce: ${bySource(missing, src)}`);
  }

  console.log("\nVšetky 4 miesta (sitemap, autocomplete, /obchody, /kupony/[slug])");
  console.log("čítajú z getAllKnownShops() — obchod prítomný v zlúčenom zozname");
  console.log("je dostupný všade. Problémové sú len nižšie uvedené záznamy.\n");

  if (aliased.length > 0) {
    console.log(`--- ZLÚČENÉ POD INÝ SLUG (${aliased.length}) — dostupné, ale pod iným obchodom ---`);
    for (const a of aliased) {
      console.log(`  [${a.raw.source}] ${a.raw.name} → ${a.into}`);
    }
  }

  if (missing.length > 0) {
    console.log(`\n--- NEDOSTUPNÉ (${missing.length}) — existujú v dátach, ale nie sú v zlúčenom zozname ---`);
    for (const m of missing) {
      console.log(`  [${m.source}] ${JSON.stringify(m.name)} (slug: ${m.slug || "—"})`);
    }
  } else {
    console.log("\n✅ Žiadny obchod nechýba — každý obchod z dát je dostupný cez všetky 4 miesta.");
  }

  process.exit(0);
}

main().catch(e => {
  console.error("Audit zlyhal:", e?.message ?? String(e));
  process.exit(1);
});
