/**
 * Audit interných shop odkazov na kategóriových stránkach /kategoria/[slug].
 * Replikuje presne logiku app/kategoria/[slug]/page.tsx (catShops + affialForCat),
 * zvaliduje každý href:
 *   1. lokálne — replika isValidShopSlug z app/kupony/[slug]/page.tsx (+ LETAKY)
 *   2. HTTP — GET na produkciu https://www.zlavickovo.sk (redirect: manual)
 *
 * Spustenie: npx tsx scripts/audit-category-shop-links.ts [--no-http]
 * Nič nemení, iba číta.
 */
import * as fs from "fs";
import * as path from "path";

async function main() {
  // Load .env.local (split /\r?\n/ — CRLF!)
  const envPath = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, "utf-8")
      .split(/\r?\n/)
      .forEach(line => {
        const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      });
  }

  const { TAXONOMY_LIST } = await import("../lib/taxonomy");
  const { AFFIAL_SHOPS, findAffialShop } = await import("../lib/affial-shops");
  const { normalizeShopName, normalizeShopSlug } = await import("../lib/slug");
  const { compareShopsByPriority } = await import("../lib/shop-priority");
  const { getAllKnownShops, getStaticKnownShops } = await import("../lib/all-shops");
  const { LETAKY } = await import("../lib/letaky");

  // ---- 1. Zber kariet presne ako app/kategoria/[slug]/page.tsx ----
  interface Card {
    category: string;
    name: string;
    slug: string;
    href: string;
    source: "taxonomy.featuredShops" | "AFFIAL_SHOPS";
  }
  const cards: Card[] = [];

  for (const cat of TAXONOMY_LIST) {
    const seenShopKeys = new Set<string>();
    const catShops = [...cat.featuredShops].sort(compareShopsByPriority).filter(shop => {
      const key = normalizeShopName(shop.name) || shop.slug;
      if (seenShopKeys.has(key)) return false;
      seenShopKeys.add(key);
      return true;
    });
    const affialForCat = AFFIAL_SHOPS
      .filter(s => s.category === cat.id)
      .sort(compareShopsByPriority)
      .filter(shop => {
        const key = normalizeShopName(shop.domain || shop.name);
        if (seenShopKeys.has(key)) return false;
        seenShopKeys.add(key);
        return true;
      });

    for (const shop of catShops) {
      cards.push({
        category: cat.id,
        name: shop.name,
        slug: shop.slug,
        href: shop.href ?? `/kupony/${shop.slug}`,
        source: "taxonomy.featuredShops",
      });
    }
    for (const shop of affialForCat) {
      const slug = normalizeShopSlug(shop.domain);
      cards.push({
        category: cat.id,
        name: shop.name,
        slug,
        href: `/kupony/${slug}`,
        source: "AFFIAL_SHOPS",
      });
    }
  }

  console.log(`Kariet obchodov na kategóriových stránkach spolu: ${cards.length}`);

  // ---- 2. Lokálna validácia — replika isValidShopSlug ----
  const TOP_SLUGS = [
    "alza","shein","zalando","mall","notino","sportisimo",
    "ikea","dedoles","martinus","about-you","answear","dr-max",
    "zara","h-m","asos","lidl","kaufland","decathlon","nike","adidas",
  ];
  const SHOP_NAME_OVERRIDES: Record<string, string> = {
    czc: "CZC.cz",
    belda: "Belda Sport",
    "kojenecke-obleceni": "Kojenecké oblečenie",
  };

  let shops;
  let shopsSource = "getAllKnownShops (live/Redis)";
  try {
    shops = await getAllKnownShops();
  } catch {
    shops = getStaticKnownShops();
    shopsSource = "getStaticKnownShops (statický fallback)";
  }
  const slugSet = new Set(shops.map((s: any) => s.slug));
  // Kanonický register (TOP_SHOPS + statické zdroje) — live Redis cache môže byť
  // po deployi až 24h stará a nový kurátorský obchod by falošne padol.
  for (const s of getStaticKnownShops()) slugSet.add(s.slug);
  console.log(`Známych obchodov: ${shops.length} (zdroj: ${shopsSource})`);

  const isValidKuponySlug = (slug: string): boolean => {
    const baseSlug = slug.endsWith("-cz") ? slug.slice(0, -3) : slug;
    if (!baseSlug) return false;
    if (TOP_SLUGS.includes(baseSlug)) return true;
    if (SHOP_NAME_OVERRIDES[baseSlug]) return true;
    if (findAffialShop(slug) || findAffialShop(baseSlug)) return true;
    return slugSet.has(baseSlug) || slugSet.has(slug);
  };
  const letakySlugs = new Set(LETAKY.map((l: any) => l.slug));

  const localResults = cards.map(card => {
    let localValid: boolean;
    let route: string;
    if (card.href.startsWith("/letaky/")) {
      route = "/letaky/[slug]";
      localValid = letakySlugs.has(card.href.slice("/letaky/".length));
    } else if (card.href.startsWith("/kupony/")) {
      route = "/kupony/[slug]";
      localValid = isValidKuponySlug(card.href.slice("/kupony/".length));
    } else {
      route = "?";
      localValid = false;
    }
    return { ...card, route, localValid };
  });

  const localInvalid = localResults.filter(r => !r.localValid);
  console.log(`\nLokálna validácia: ${localResults.length - localInvalid.length} OK, ${localInvalid.length} NEVALIDNÝCH:`);
  for (const r of localInvalid) {
    console.log(`  [${r.category}] ${r.name} | slug=${r.slug} | ${r.href} | zdroj=${r.source}`);
  }

  // Tvrdá kontrola: featuredShops v lib/taxonomy.ts nesmie obsahovať slug
  // neplatný podľa kanonického registra — skript končí exit 1 (použiteľné v CI).
  const invalidFeatured = localInvalid.filter(r => r.source === "taxonomy.featuredShops");
  if (invalidFeatured.length > 0) {
    console.error(`\nCHYBA: ${invalidFeatured.length} featuredShops slugov v lib/taxonomy.ts je mimo kanonického registra.`);
    process.exitCode = 1;
  }

  // Diagnóza: existuje pre nevalidný slug „správny" kanonický slug?
  console.log(`\nDiagnóza nevalidných slugov (hľadanie kanonického tvaru):`);
  for (const r of localInvalid) {
    const candidates = new Set<string>();
    const stripped = r.slug.replace(/-(sk|cz|eu|com)$/i, "");
    if (stripped !== r.slug) candidates.add(stripped);
    candidates.add(normalizeShopSlug(r.name));
    const found: string[] = [];
    for (const c of candidates) {
      if (c && isValidKuponySlug(c)) found.push(c);
    }
    // aj podľa mena v known shops
    const norm = normalizeShopName(r.name);
    const byName = shops.filter((s: any) => normalizeShopName(s.name) === norm).map((s: any) => `${s.slug} (source=${s.source}, name=${s.name})`);
    console.log(`  ${r.slug}: kanonický kandidát valídny: ${found.length ? found.join(", ") : "ŽIADEN"}; v known shops podľa mena: ${byName.length ? byName.join("; ") : "NIE JE"}`);
  }

  // ---- 3. HTTP validácia proti produkcii ----
  if (process.argv.includes("--no-http")) {
    console.log("\n(HTTP kontrola preskočená --no-http)");
    return;
  }
  const BASE = "https://www.zlavickovo.sk";
  const uniqueHrefs = [...new Set(localResults.map(r => r.href))];
  console.log(`\nHTTP kontrola ${uniqueHrefs.length} unikátnych URL na ${BASE} ...`);

  const statusByHref = new Map<string, number | string>();
  const CONC = 5;
  let idx = 0;
  async function worker() {
    while (idx < uniqueHrefs.length) {
      const href = uniqueHrefs[idx++];
      try {
        const res = await fetch(BASE + href, {
          method: "GET",
          redirect: "manual",
          headers: { "user-agent": "zlavickovo-audit/1.0" },
          signal: AbortSignal.timeout(30000),
        });
        statusByHref.set(href, res.status);
        // telo netreba
        try { await res.arrayBuffer(); } catch {}
      } catch (e: any) {
        statusByHref.set(href, `ERR:${e?.name ?? e}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));

  const rows = localResults.map(r => ({ ...r, http: statusByHref.get(r.href) ?? "?" }));
  const buckets = { ok: [] as any[], redirect: [] as any[], notfound: [] as any[], server: [] as any[], err: [] as any[] };
  for (const r of rows) {
    const s = r.http;
    if (typeof s !== "number") buckets.err.push(r);
    else if (s === 200) buckets.ok.push(r);
    else if (s >= 300 && s < 400) buckets.redirect.push(r);
    else if (s === 404) buckets.notfound.push(r);
    else if (s >= 500) buckets.server.push(r);
    else buckets.err.push(r);
  }

  console.log(`\n===== HTTP VÝSLEDKY (kariet: ${rows.length}, unikátnych URL: ${uniqueHrefs.length}) =====`);
  console.log(`200:        ${buckets.ok.length}`);
  console.log(`redirect:   ${buckets.redirect.length}`);
  console.log(`404:        ${buckets.notfound.length}`);
  console.log(`500+:       ${buckets.server.length}`);
  console.log(`iné/chyba:  ${buckets.err.length}`);

  const dump = (label: string, arr: any[]) => {
    if (!arr.length) return;
    console.log(`\n--- ${label} ---`);
    for (const r of arr) {
      console.log(`  [${r.category}] ${r.name} | slug=${r.slug} | ${r.href} | HTTP ${r.http} | localValid=${r.localValid} | zdroj=${r.source}`);
    }
  };
  dump("REDIRECT", buckets.redirect);
  dump("404", buckets.notfound);
  dump("500+", buckets.server);
  dump("INÉ/CHYBA", buckets.err);

  // Nesúlad lokálnej validácie a HTTP
  const mismatch = rows.filter(r => (r.http === 404) !== !r.localValid && typeof r.http === "number" && (r.http === 200 || r.http === 404));
  if (mismatch.length) {
    console.log(`\n--- NESÚLAD lokálna validácia vs HTTP ---`);
    for (const r of mismatch) {
      console.log(`  ${r.href}: localValid=${r.localValid}, HTTP=${r.http}`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
