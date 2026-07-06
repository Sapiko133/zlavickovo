/**
 * Audit soft-404 opravy na /kupony/[slug] — overuje, že:
 *   1. každý /kupony/ slug zo sitemap prejde validáciou isValidShopSlug
 *      (žiadna sitemap URL nesmie po oprave vracať 404)
 *   2. vymyslené slugy validáciou neprejdú (vracajú 404)
 *
 * Spustenie: npx tsx scripts/audit-soft404.ts [cesta k súboru so slugmi, 1/riadok]
 * Bez argumentu porovná sitemap slugy priamo z getAllKnownShops (rovnaký zdroj).
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

  const { getAllKnownShops, getStaticKnownShops } = await import("../lib/all-shops");
  const { findAffialShop } = await import("../lib/affial-shops");

  // Replika konštánt z app/kupony/[slug]/page.tsx
  const TOP_SLUGS = [
    "alza","shein","zalando","mall","notino","sportisimo",
    "ikea","dedoles","martinus","about-you","answear","dr-max",
    "zara","h-m","asos","lidl","kaufland","decathlon","nike","adidas",
  ];
  const SHOP_NAME_OVERRIDES: Record<string, string> = { czc: "CZC.cz" };

  let shops;
  try { shops = await getAllKnownShops(); } catch { shops = getStaticKnownShops(); }
  const slugSet = new Set(shops.map(s => s.slug));
  console.log(`Známych obchodov: ${shops.length}`);

  // Rovnaká logika ako isValidShopSlug v app/kupony/[slug]/page.tsx
  const isValid = (slug: string): boolean => {
    const baseSlug = slug.endsWith("-cz") ? slug.slice(0, -3) : slug;
    if (!baseSlug) return false;
    if (TOP_SLUGS.includes(baseSlug)) return true;
    if (SHOP_NAME_OVERRIDES[baseSlug]) return true;
    if (findAffialShop(slug) || findAffialShop(baseSlug)) return true;
    return slugSet.has(baseSlug) || slugSet.has(slug);
  };

  // Slugy zo súboru (dump zo sitemap), inak rekonštrukcia podľa app/sitemap.ts
  let slugs: string[];
  if (process.argv[2]) {
    slugs = fs.readFileSync(process.argv[2], "utf-8").split(/\r?\n/).filter(Boolean);
  } else {
    slugs = shops.flatMap(s => (s.source === "dognet" ? [s.slug, `${s.slug}-cz`] : [s.slug]));
  }

  const invalid = slugs.filter(s => !isValid(s));
  console.log(`Sitemap /kupony/ slugov: ${slugs.length}`);
  console.log(`Validných: ${slugs.length - invalid.length}`);
  console.log(`NEVALIDNÝCH (404 riziko): ${invalid.length}`);
  if (invalid.length > 0) console.log(invalid.slice(0, 50).join("\n"));

  const fakes = ["random-obchod-xyz","test-test-test","protein-sk-random","aaaaaaaaaaaaaaaa","random-neexistujuci-obchod-xyz"];
  let fakePassed = 0;
  for (const f of fakes) {
    const ok = !isValid(f);
    if (!ok) fakePassed++;
    console.log(`fake ${f}: ${ok ? "404 ✓" : "!! PREŠIEL VALIDÁCIOU (chyba)"}`);
  }

  if (invalid.length > 0 || fakePassed > 0) process.exit(1);
  console.log("✅ Audit OK");
}

main().catch(e => { console.error(e); process.exit(1); });
