/**
 * Audit vyhľadávania — overuje Fázu 1 opráv proti nasadenému webu:
 *   1. feed-search meny: .cz domény → Kč, ostatné → €
 *   2. kupóny v unified autocomplete (Dognet + eHub + Affial + CJ + statické Affial)
 *   3. klasifikátor: dopyt smeruje na /kupony/[slug] len ak obchod existuje
 *      v getAllKnownShops() (žiadny ručný SHOP_LIST)
 *   4. relevancia obchodov: exact → prefix → substring ("mall" → Mall pred BabyMall)
 *
 * Fáza 2 — normalizované vyhľadávanie (lib/search-normalize.ts):
 *   5. páry dopytov (diakritika/whitespace/interpunkcia) vracajú rovnaké výsledky
 *   6. žiadne false positives — "kava" nenájde "získavajte" (word boundary)
 *
 * Spustenie: npx tsx scripts/audit-search.ts [base-url]
 * Default base: https://www.zlavickovo.sk (API volať na www, apex vracia 308)
 */
import { findShopInList } from "../lib/search/queryClassifier";
import { matchesSearchTokens, searchMatchRank } from "../lib/search-normalize";

const BASE = process.argv[2] || "https://www.zlavickovo.sk";
const QUERIES = ["alza", "datart", "mall", "czc", "notino", "gymbeam", "samsung"];

let failures = 0;

function check(ok: boolean, label: string) {
  console.log(`  ${ok ? "✅" : "❌"} ${label}`);
  if (!ok) failures++;
}

async function getJson(path: string): Promise<any> {
  const r = await fetch(BASE + path, { headers: { "User-Agent": "audit-search" } });
  if (!r.ok) throw new Error(`${path} → HTTP ${r.status}`);
  return r.json();
}

async function main() {
  console.log(`Audit vyhľadávania proti: ${BASE}\n`);

  // ── 1. Meny vo feed-search ────────────────────────────────────
  console.log("── 1. feed-search meny (CZ → Kč, SK → €) ──");
  const czProducts: any[] = [];
  const skProducts: any[] = [];
  for (const q of ["protein", "matrac", "konopny", "kolagen", "postel"]) {
    const d = await getJson(`/api/feed-search?q=${encodeURIComponent(q)}`);
    if (!Array.isArray(d)) continue;
    for (const p of d) {
      if (/\.cz$/.test(p.domain) && czProducts.length < 3) czProducts.push(p);
      else if (/\.sk$/.test(p.domain) && skProducts.length < 3) skProducts.push(p);
    }
    if (czProducts.length >= 3 && skProducts.length >= 3) break;
  }
  check(czProducts.length >= 3, `nájdené aspoň 3 CZ produkty (${czProducts.length})`);
  check(skProducts.length >= 3, `nájdené aspoň 3 SK produkty (${skProducts.length})`);
  for (const p of czProducts) {
    check(p.price.includes("Kč"), `CZ [${p.domain}] "${p.price}" obsahuje Kč — ${p.name.slice(0, 40)}`);
  }
  for (const p of skProducts) {
    check(p.price.includes("€"), `SK [${p.domain}] "${p.price}" obsahuje € — ${p.name.slice(0, 40)}`);
  }

  // ── 2. Kupóny v unified autocomplete ─────────────────────────
  // Parita so shop stránkou: ak /kupony/[slug] zobrazuje kupóny, musí ich
  // zobrazovať aj vyhľadávanie
  console.log("\n── 2. kupóny vo vyhľadávaní (unified autocomplete vs shop stránka) ──");
  const unified: Record<string, any> = {};
  for (const q of QUERIES) {
    unified[q] = await getJson(`/api/autocomplete?mode=unified&q=${encodeURIComponent(q)}`);
  }
  for (const q of ["alza", "notino", "gymbeam", "datart"]) {
    const html = await fetch(`${BASE}/kupony/${q}`, { headers: { "User-Agent": "audit-search" } }).then(r => r.text());
    const shopCount = parseInt(html.match(/(\d+)(?:<!-- -->)? overených kupónov/)?.[1] ?? "0", 10);
    const n = (unified[q].coupons ?? []).length;
    if (shopCount > 0) {
      check(n > 0, `"${q}" → shop stránka ${shopCount}, vyhľadávanie ${n} kupónov ${n > 0 ? `(napr. "${unified[q].coupons[0].title.slice(0, 40)}")` : ""}`);
    } else {
      console.log(`  ℹ️  "${q}" → shop stránka 0 kupónov, vyhľadávanie ${n} (parita OK)`);
    }
  }

  // ── 3. Klasifikátor — len existujúce obchody ─────────────────
  console.log("\n── 3. klasifikátor (zdroj pravdy: getAllKnownShops cez /api/autocomplete) ──");
  const allShops = await getJson(`/api/autocomplete`);
  check(Array.isArray(allShops) && allShops.length > 100, `zoznam obchodov načítaný (${allShops.length})`);
  for (const q of QUERIES) {
    const hit = findShopInList(q, allShops);
    const exists = Array.isArray(allShops) && allShops.some((s: any) => s.slug === hit?.slug);
    if (hit) {
      check(exists, `"${q}" → /kupony/${hit.slug} (obchod existuje)`);
    } else {
      console.log(`  ℹ️  "${q}" → žiadny obchod, ostáva fulltext /hladat`);
    }
  }
  check(findShopInList("samsung", allShops) === null || allShops.some((s: any) => s.slug === "samsung"),
    `"samsung" nesmeruje na neexistujúci /kupony/samsung`);

  // ── 4. Relevancia obchodov ───────────────────────────────────
  console.log("\n── 4. relevancia (exact → prefix → substring) ──");
  for (const q of QUERIES) {
    const shops = (unified[q].shops ?? []).map((s: any) => s.name);
    console.log(`  "${q}": ${shops.join(" | ") || "(žiadne)"}`);
  }
  const mallShops = (unified["mall"].shops ?? []).map((s: any) => s.slug);
  check(mallShops[0] === "mall", `"mall" → prvý výsledok je Mall (${mallShops[0] ?? "žiadny"})`);

  // ── 5. Fáza 2 — normalizované páry (diakritika / whitespace / bodky) ──
  console.log("\n── 5. normalizácia — páry dopytov vracajú rovnaký prvý obchod ──");
  const SHOP_PAIRS: [string, string][] = [
    ["gym beam", "gymbeam"],
    ["dr max", "dr.max"],
    ["aboutyou", "about you"],
    ["alza sk", "alza"],
    ["kava", "káva"],
    ["sluchadla", "slúchadlá"],
  ];
  for (const [a, b] of SHOP_PAIRS) {
    const [ua, ub] = await Promise.all([
      getJson(`/api/autocomplete?mode=unified&q=${encodeURIComponent(a)}`),
      getJson(`/api/autocomplete?mode=unified&q=${encodeURIComponent(b)}`),
    ]);
    const sa = ua.shops?.[0]?.slug ?? null;
    const sb = ub.shops?.[0]?.slug ?? null;
    check(sa === sb && sb !== null, `"${a}" ↔ "${b}" → rovnaký prvý obchod (${sa ?? "žiadny"} / ${sb ?? "žiadny"})`);
  }

  console.log("\n── 5b. normalizácia — diakritické páry vracajú rovnaké produkty ──");
  const PRODUCT_PAIRS: [string, string][] = [
    ["kava", "káva"],
    ["kavovar", "kávovar"],
    ["sluchadla", "slúchadlá"],
  ];
  for (const [a, b] of PRODUCT_PAIRS) {
    const [fa, fb] = await Promise.all([
      getJson(`/api/feed-search?q=${encodeURIComponent(a)}`),
      getJson(`/api/feed-search?q=${encodeURIComponent(b)}`),
    ]);
    const na = Array.isArray(fa) ? fa.length : 0;
    const nb = Array.isArray(fb) ? fb.length : 0;
    check(na > 0 && na === nb, `"${a}" (${na}) ↔ "${b}" (${nb}) → rovnaký počet produktov > 0`);
  }

  // ── 6. Fáza 2 — false positives (word boundary) ──────────────
  console.log("\n── 6. false positives — \"kava\" nesmie matchovať stred slova (získavajte) ──");
  const kavaFeed = await getJson(`/api/feed-search?q=kava`);
  for (const p of (Array.isArray(kavaFeed) ? kavaFeed : []).slice(0, 20)) {
    const ok = matchesSearchTokens(p.name, "kava") || matchesSearchTokens(p.description ?? "", "kava");
    check(ok, `"kava" → "${String(p.name).slice(0, 50)}" má zhodu na hranici slova`);
  }
  check(!matchesSearchTokens("Získavajte body za nákup", "kava"),
    `unit: "kava" nematchuje titulok "Získavajte body za nákup"`);
  check(searchMatchRank("Káva Lavazza", "kava") >= 0, `unit: "kava" matchuje "Káva Lavazza"`);
  check(searchMatchRank("GymBeam", "gym beam") === 0, `unit: "gym beam" = exact match na "GymBeam"`);
  check(searchMatchRank("Dr. Max", "dr max") === 0, `unit: "dr max" = exact match na "Dr. Max"`);

  console.log(`\n${failures === 0 ? "✅ Audit OK" : `❌ Audit: ${failures} zlyhaní`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(err => { console.error(err); process.exit(1); });
