/**
 * READ-ONLY audit produktového matchingu (EAN / manufacturer+productno / názov).
 *
 * Nezapisuje do DB ani nikam inam — stiahne vzorky Heureka feedov (rovnaké dáta,
 * aké importuje lib/heureka/import.ts do hk_products) a nad nimi simuluje
 * matching logiku getBestPurchase (lib/heureka/query.ts):
 *   1. EAN (presná zhoda stringu),
 *   2. manufacturer+productno (lower(manufacturer), presné productno),
 *   3. lower(name) presná zhoda ako fallback.
 *
 * Meria: pokrytie identifikátorov, validitu EAN (dĺžka/číslice/kontrolná číslica),
 * cross-domain skupiny, konflikty variantov (rovnaký kľúč, rôzne EAN/kapacity),
 * cenové anomálie (max/min pomer > 2.0 po normalizácii mien cez EUR_TO_CZK_RATE).
 *
 * Spustenie: npx tsx scripts/audit-product-matching.ts
 */
import fs from "node:fs";
import path from "node:path";

// .env.local — splitovať /\r?\n/ (CRLF na Windows)
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

import { HEUREKA_FEEDS } from "../lib/heureka/feeds";
import { parseHeurekaXmlDetailed, type ParsedProduct } from "../lib/heureka/parser";
import { resolveProductCurrency, getEurToCzkRate, parsePriceValue, type SupportedCurrency } from "../lib/price";

const MAX_ITEMS = 1000; // zrkadlí produkčné HEUREKA_MAX_ITEMS=1000
const MAX_BYTES = 25 * 1024 * 1024;
const PRICE_RATIO_THRESHOLD = 2.0;

// ---- stream-capped fetch (rovnaký prístup ako lib/heureka/import.ts) ----
function nextShopitemEnd(xml: string, from: number): number {
  const upper = xml.indexOf("</SHOPITEM>", from);
  const lower = xml.indexOf("</shopitem>", from);
  const idx = upper === -1 ? lower : lower === -1 ? upper : Math.min(upper, lower);
  return idx === -1 ? -1 : idx + "</SHOPITEM>".length;
}
function closeTruncatedXml(xml: string): string {
  const closers: string[] = [];
  for (const m of xml.slice(0, 4096).matchAll(/<(rss|RSS|SHOP|shop)(?=[\s>])/g)) closers.unshift(`</${m[1]}>`);
  return xml + closers.join("");
}
async function fetchXml(url: string): Promise<string> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(60000),
    headers: { "User-Agent": "Zlavickovo/1.0 (+https://zlavickovo.sk)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (!res.body) return res.text();
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let xml = "";
  let items = 0;
  let searchFrom = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return xml + decoder.decode();
      xml += decoder.decode(value, { stream: true });
      let end: number;
      while (items < MAX_ITEMS && (end = nextShopitemEnd(xml, searchFrom)) !== -1) {
        items++;
        searchFrom = end;
      }
      if (items >= MAX_ITEMS) return closeTruncatedXml(xml.slice(0, searchFrom));
      if (xml.length >= MAX_BYTES) return searchFrom > 0 ? closeTruncatedXml(xml.slice(0, searchFrom)) : xml;
    }
  } finally {
    reader.cancel().catch(() => {});
  }
}

// ---- EAN / GTIN validácia ----
function eanDigits(raw: string): string {
  return raw.replace(/[\s\-]/g, "");
}
function isNumeric(s: string): boolean {
  return /^\d+$/.test(s);
}
function gtinChecksumValid(digits: string): boolean {
  // GTIN-8/12/13/14 — pad na 14, váhy 3/1 sprava, posledná = kontrolná
  const padded = digits.padStart(14, "0");
  let sum = 0;
  for (let i = 0; i < 13; i++) sum += Number(padded[i]) * (i % 2 === 0 ? 3 : 1);
  return (10 - (sum % 10)) % 10 === Number(padded[13]);
}
function isPlaceholderEan(digits: string): boolean {
  return /^0+$/.test(digits) || /^(\d)\1+$/.test(digits) || digits === "1234567890123";
}
type EanQuality = "valid" | "bad_length" | "non_numeric" | "checksum_fail" | "placeholder";
function classifyEan(raw: string): EanQuality {
  const d = eanDigits(raw);
  if (!isNumeric(d)) return "non_numeric";
  if (![8, 12, 13, 14].includes(d.length)) return "bad_length";
  if (isPlaceholderEan(d)) return "placeholder";
  if (!gtinChecksumValid(d)) return "checksum_fail";
  return "valid";
}

// ---- variantové tokeny v názve (kapacita/veľkosť/kusy/edícia) ----
const VARIANT_TOKEN_RE =
  /\b(\d+(?:[.,]\d+)?)\s*(gb|tb|mb|ml|l|g|kg|mg|cm|mm|m|ks|pcs|tbl|kaps|x\d+)\b|\b(pro|plus|max|mini|lite|xl|xxl|xs)\b/gi;
function variantTokens(name: string): string {
  const found = [...name.toLowerCase().matchAll(VARIANT_TOKEN_RE)].map((m) => m[0].replace(/\s+/g, ""));
  return found.sort().join(",");
}

interface Row {
  domain: string;
  name: string;
  ean: string;
  manufacturer: string;
  productno: string;
  priceEur: number | null; // normalizovaná cena v EUR; null = neznáma mena/kurz/cena
  currency: SupportedCurrency | null;
  priceRaw: string;
}

function groupBy<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    if (!k) continue;
    const arr = map.get(k);
    if (arr) arr.push(r);
    else map.set(k, [r]);
  }
  return map;
}

function priceRatio(rows: Row[]): number | null {
  const prices = rows.map((r) => r.priceEur).filter((p): p is number => p !== null && p > 0);
  if (prices.length < 2) return null;
  return Math.max(...prices) / Math.min(...prices);
}

async function main() {
  const rate = getEurToCzkRate();
  console.log(`Feedov: ${HEUREKA_FEEDS.length}, vzorka max ${MAX_ITEMS}/feed, EUR_TO_CZK_RATE=${rate ?? "CHÝBA"}\n`);

  const rows: Row[] = [];
  const feedErrors: string[] = [];
  const BATCH = 8;
  for (let i = 0; i < HEUREKA_FEEDS.length; i += BATCH) {
    const batch = HEUREKA_FEEDS.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (feed) => {
        try {
          const xml = await fetchXml(feed.url);
          const parsed = parseHeurekaXmlDetailed(xml, feed.category, { maxItems: MAX_ITEMS });
          for (const p of parsed.products as ParsedProduct[]) {
            const currency = resolveProductCurrency(p.price, p.currencyCode ?? feed.currencyCode, feed.domain);
            const num = parsePriceValue(p.price);
            const priceEur =
              num === null || !currency ? null : currency === "EUR" ? num : rate ? num / rate : null;
            rows.push({
              domain: feed.domain,
              name: p.name,
              ean: p.ean.trim(),
              manufacturer: p.manufacturer.trim(),
              productno: p.productno.trim(),
              priceEur,
              currency,
              priceRaw: p.price,
            });
          }
        } catch (err: any) {
          feedErrors.push(`${feed.domain}: ${String(err?.message ?? err).slice(0, 80)}`);
        }
      })
    );
    process.stderr.write(`  ...${Math.min(i + BATCH, HEUREKA_FEEDS.length)}/${HEUREKA_FEEDS.length}\n`);
  }

  const total = rows.length;
  console.log(`Produktov vo vzorke: ${total}; feedov s chybou: ${feedErrors.length}`);
  feedErrors.forEach((e) => console.log(`  ✗ ${e}`));

  // ── 1. Pokrytie identít (v poradí getBestPurchase) ──
  const eanQuality = new Map<EanQuality, number>();
  for (const r of rows.filter((r) => r.ean)) {
    const q = classifyEan(r.ean);
    eanQuality.set(q, (eanQuality.get(q) ?? 0) + 1);
  }
  const withEan = rows.filter((r) => r.ean).length;
  const withValidEan = rows.filter((r) => r.ean && classifyEan(r.ean) === "valid").length;
  const withMfrPno = rows.filter((r) => r.manufacturer && r.productno).length;
  const nameOnly = rows.filter((r) => !r.ean && !(r.manufacturer && r.productno)).length;

  console.log("\n=== 1. POKRYTIE IDENTÍT ===");
  console.log(`s EAN (neprázdny):            ${withEan} (${((withEan / total) * 100).toFixed(1)}%)`);
  console.log(`s validným GTIN (checksum):   ${withValidEan} (${((withValidEan / total) * 100).toFixed(1)}%)`);
  console.log(`s manufacturer+productno:     ${withMfrPno} (${((withMfrPno / total) * 100).toFixed(1)}%)`);
  console.log(`iba názvový fallback:         ${nameOnly} (${((nameOnly / total) * 100).toFixed(1)}%)`);
  console.log("EAN kvalita:", Object.fromEntries(eanQuality));

  // ── 2. EAN: rovnaký EAN, viac názvov / viac domén ──
  const byEan = groupBy(rows.filter((r) => r.ean), (r) => r.ean);
  const eanMultiDomain = [...byEan.values()].filter((g) => new Set(g.map((r) => r.domain)).size > 1);
  const eanMultiName = [...byEan.values()].filter((g) => new Set(g.map((r) => r.name.toLowerCase())).size > 1);
  const eanPriceAnomalies = eanMultiDomain
    .map((g) => ({ g, ratio: priceRatio(g) }))
    .filter((x) => x.ratio !== null && x.ratio > PRICE_RATIO_THRESHOLD);

  console.log("\n=== 2. EAN SKUPINY ===");
  console.log(`unikátnych EAN:                     ${byEan.size}`);
  console.log(`EAN vo viacerých doménach:          ${eanMultiDomain.length}`);
  console.log(`EAN s viac ako 1 názvom:            ${eanMultiName.length}`);
  console.log(`EAN cross-domain, cenový pomer > ${PRICE_RATIO_THRESHOLD}: ${eanPriceAnomalies.length}`);
  console.log("\nVzorka EAN skupín s rôznymi názvami (max 15):");
  for (const g of eanMultiName.slice(0, 15)) {
    const names = [...new Set(g.map((r) => `${r.name} [${r.domain}]`))].slice(0, 3);
    console.log(`  EAN ${g[0].ean} (${classifyEan(g[0].ean)}):`);
    names.forEach((n) => console.log(`    - ${n}`));
  }
  console.log("\nVzorka EAN cenových anomálií (max 10):");
  for (const { g, ratio } of eanPriceAnomalies.slice(0, 10)) {
    console.log(`  EAN ${g[0].ean} pomer ${ratio!.toFixed(2)}:`);
    g.slice(0, 4).forEach((r) => console.log(`    - ${r.priceEur?.toFixed(2)} € | ${r.name.slice(0, 70)} [${r.domain}]`));
  }

  // ── 3. manufacturer+productno ──
  const withPair = rows.filter((r) => r.manufacturer && r.productno);
  const byMfrPno = groupBy(withPair, (r) => `${r.manufacturer.toLowerCase()}|${r.productno}`);
  const pairMultiDomain = [...byMfrPno.values()].filter((g) => new Set(g.map((r) => r.domain)).size > 1);
  const pairMultiEan = [...byMfrPno.values()].filter(
    (g) => new Set(g.filter((r) => r.ean).map((r) => r.ean)).size > 1
  );
  // productno zdieľané viacerými výrobcami
  const byPno = groupBy(withPair, (r) => r.productno);
  const pnoMultiMfr = [...byPno.values()].filter((g) => new Set(g.map((r) => r.manufacturer.toLowerCase())).size > 1);
  // varianty spellingu výrobcu
  const byMfrLower = groupBy(rows.filter((r) => r.manufacturer), (r) => r.manufacturer.toLowerCase());
  const mfrSpellings = [...byMfrLower.values()].filter((g) => new Set(g.map((r) => r.manufacturer)).size > 1);
  const pairPriceAnomalies = pairMultiDomain
    .map((g) => ({ g, ratio: priceRatio(g) }))
    .filter((x) => x.ratio !== null && x.ratio > PRICE_RATIO_THRESHOLD);

  console.log("\n=== 3. MANUFACTURER + PRODUCTNO ===");
  console.log(`párov (mfr+pno) unikátnych:            ${byMfrPno.size}`);
  console.log(`pár vo viacerých doménach:             ${pairMultiDomain.length}`);
  console.log(`pár s viac ako 1 rôznym EAN (KONFLIKT): ${pairMultiEan.length}`);
  console.log(`productno zdieľané viac výrobcami:     ${pnoMultiMfr.length}`);
  console.log(`výrobca s viac spellingami (case):     ${mfrSpellings.length}`);
  console.log(`pár cross-domain, cenový pomer > ${PRICE_RATIO_THRESHOLD}:  ${pairPriceAnomalies.length}`);
  console.log("\nVzorka párov s viacerými EAN (max 10):");
  for (const g of pairMultiEan.slice(0, 10)) {
    console.log(`  ${g[0].manufacturer} | ${g[0].productno}:`);
    [...new Set(g.map((r) => `EAN ${r.ean || "—"} | ${r.name.slice(0, 60)} [${r.domain}]`))]
      .slice(0, 4)
      .forEach((n) => console.log(`    - ${n}`));
  }

  // ── 4. Presná zhoda názvu (lower(name)) — produkčný fallback ──
  const byName = groupBy(rows, (r) => r.name.toLowerCase());
  const nameCrossDomain = [...byName.values()].filter((g) => new Set(g.map((r) => r.domain)).size > 1);
  // fallback sa použije len ak produkt NEMÁ silné ID — zúž na name-only riadky
  const nameOnlyRows = rows.filter((r) => !r.ean && !(r.manufacturer && r.productno));
  const byNameFallback = groupBy(nameOnlyRows, (r) => r.name.toLowerCase());
  // ale pozor: fallback dotaz matchuje VŠETKY riadky s rovnakým názvom (aj tie so silným ID)
  const fallbackCrossDomain = [...byNameFallback.keys()]
    .map((k) => byName.get(k)!)
    .filter((g) => new Set(g.map((r) => r.domain)).size > 1);
  const nameDiffEan = nameCrossDomain.filter(
    (g) => new Set(g.filter((r) => r.ean).map((r) => r.ean)).size > 1
  );
  const nameDiffMfr = nameCrossDomain.filter(
    (g) => new Set(g.filter((r) => r.manufacturer).map((r) => r.manufacturer.toLowerCase())).size > 1
  );
  const namePriceAnomalies = nameCrossDomain
    .map((g) => ({ g, ratio: priceRatio(g) }))
    .filter((x) => x.ratio !== null && x.ratio > PRICE_RATIO_THRESHOLD);

  console.log("\n=== 4. PRESNÁ ZHODA NÁZVU ===");
  console.log(`skupín s rovnakým názvom cross-domain:            ${nameCrossDomain.length}`);
  console.log(`z toho dostupných name-only fallbacku:            ${fallbackCrossDomain.length}`);
  console.log(`cross-domain skupín s ROZDIELNYM EAN (KONFLIKT):  ${nameDiffEan.length}`);
  console.log(`cross-domain skupín s rozdielnym výrobcom:        ${nameDiffMfr.length}`);
  console.log(`cross-domain skupín s cenovým pomerom > ${PRICE_RATIO_THRESHOLD}:      ${namePriceAnomalies.length}`);

  console.log("\nVzorka 50 cross-domain názvových zhôd:");
  for (const g of nameCrossDomain.slice(0, 50)) {
    const domains = [...new Set(g.map((r) => r.domain))];
    const prices = g.map((r) => (r.priceEur !== null ? r.priceEur.toFixed(2) + "€" : "?")).join(", ");
    console.log(`  [${domains.join(" + ")}] ${g[0].name.slice(0, 80)} | ceny: ${prices}`);
  }

  console.log("\nNázvové skupiny s rozdielnym EAN (max 15):");
  for (const g of nameDiffEan.slice(0, 15)) {
    console.log(`  "${g[0].name.slice(0, 70)}"`);
    [...new Set(g.map((r) => `EAN ${r.ean || "—"} [${r.domain}] ${r.priceEur?.toFixed(2) ?? "?"}€`))]
      .slice(0, 4)
      .forEach((n) => console.log(`    - ${n}`));
  }

  console.log("\nNázvové cenové anomálie > 2.0 (max 15):");
  for (const { g, ratio } of namePriceAnomalies.slice(0, 15)) {
    console.log(`  pomer ${ratio!.toFixed(2)} | "${g[0].name.slice(0, 70)}"`);
    g.slice(0, 4).forEach((r) =>
      console.log(`    - ${r.priceEur?.toFixed(2)}€ (${r.priceRaw} ${r.currency ?? "?"}) [${r.domain}]`)
    );
  }

  // ── 5. Variantové tokeny — koľko takmer-identických názvov sa líši len variantom ──
  // (riziko budúcej agresívnejšej normalizácie; dnešný exact match ich NEspojí)
  const byNameNoVariant = groupBy(rows, (r) =>
    r.name.toLowerCase().replace(VARIANT_TOKEN_RE, "").replace(/\s+/g, " ").trim()
  );
  const variantCollisions = [...byNameNoVariant.values()].filter(
    (g) => new Set(g.map((r) => variantTokens(r.name))).size > 1
  );
  console.log("\n=== 5. VARIANTOVÉ RIZIKO (informatívne) ===");
  console.log(
    `Skupín názvov líšiacich sa LEN variantovým tokenom (kapacita/veľkosť/ks/Pro...): ${variantCollisions.length}`
  );
  console.log("Vzorka (max 10):");
  for (const g of variantCollisions.slice(0, 10)) {
    [...new Set(g.map((r) => r.name))].slice(0, 3).forEach((n) => console.log(`    - ${n.slice(0, 90)}`));
    console.log("    ---");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
