/**
 * Recovery + pattern discovery pre zvyšné Affial obchody (2. kolo po CSV importe).
 *
 * Pre KAŽDÝ obchod z CSV, ktorého doména nie je v HEUREKA_FEEDS (bez ohľadu na
 * to, či mal v CSV Heureka/Google/Mergado feed), skúsi nájsť validný Heureka
 * feed:
 *   1. presnú CSV Heureka URL (ak bola Heureka-formát) — retry s reálnymi limitmi,
 *   2. štandardné Heureka cesty (rovnaké vzory ako lib/feeds/AffialDiscovery.ts).
 *
 * Používa REÁLNE limity importu (60 s timeout, 60 MB cap) — na rozdiel od
 * validate-affial-feeds.ts, ktorý bol prísnejší a hlásil false-negatívy.
 *
 * Bezpečnostný + trhový filter: preskočí alkohol/vape/e-obojky/adult a .hu/.pl/.de.
 *
 * Spustenie: npx tsx scripts/discover-affial-feeds.ts
 */
import { readFileSync } from "node:fs";
import { parseHeurekaXmlDetailed } from "../lib/heureka/parser.ts";
import { HEUREKA_FEEDS } from "../lib/heureka/feeds.ts";

const CSV_PATH = "XML FEEDY - XML feedy.csv";
const HEAD_TIMEOUT_MS = 8_000;
const GET_TIMEOUT_MS = 60_000;
const MAX_BYTES = 60 * 1024 * 1024;

const BLOCK = [
  "drinkcentrum", "vaporism", "bottle-store", // alkohol / vape
  "vycvikove-obojky", "elektronicky-obojok", "elektromos-nyakorv", // e-obojky
];
const FOREIGN_TLD = [".hu", ".pl", ".de", ".at", ".ro", ".hr"];

const PATTERNS = [
  (d: string) => `https://www.${d}/heureka/export/products.xml`,
  (d: string) => `https://${d}/heureka/export/products.xml`,
  (d: string) => `https://www.${d}/export/heureka.xml`,
  (d: string) => `https://${d}/export/heureka.xml`,
  (d: string) => `https://www.${d}/feed/heureka`,
  (d: string) => `https://${d}/feed/heureka`,
  (d: string) => `https://www.${d}/heureka.xml`,
];

function splitCsvLine(line: string): string[] {
  return (line.match(/(".*?"|[^,]*)(,|$)/g) ?? [])
    .map((s) => s.replace(/,$/, "").replace(/^"|"$/g, "").trim())
    .slice(0, 4);
}

function shopDomain(campaign: string): string | null {
  let c = campaign.trim().toLowerCase();
  if (/^https?:\/\//.test(c)) {
    try {
      c = new URL(c).hostname;
    } catch {
      return null;
    }
  }
  c = c.replace(/\s*\(.*?\)\s*/g, ""); // "incognito.eco (cz)" -> "incognito.eco"
  const m = c.match(/([a-z0-9][a-z0-9-]*\.)+[a-z]{2,}/); // prvý doménový token
  if (!m) return null;
  return m[0].replace(/^www\./, "");
}

interface Row {
  category: string;
  domain: string;
  csvHeurekaUrl: string | null;
}

function loadRows(): Row[] {
  const existDomains = new Set(HEUREKA_FEEDS.map((f) => f.domain.toLowerCase()));
  const lines = readFileSync(CSV_PATH, "utf8").split(/\r?\n/).slice(1);
  const byDomain = new Map<string, Row>();

  for (const line of lines) {
    if (!line.trim() || /^,+$/.test(line)) continue;
    const [category, campaign, url, format] = splitCsvLine(line);
    const domain = shopDomain(campaign) ?? (url ? shopDomain(url) : null);
    if (!domain) continue;
    if (existDomains.has(domain)) continue;
    if (BLOCK.some((b) => domain.includes(b))) continue;
    if (FOREIGN_TLD.some((t) => domain.endsWith(t))) continue;

    const fmt = (format ?? "").toLowerCase();
    const isHeurekaUrl =
      /^https?:\/\//.test(url ?? "") && (fmt.includes("heureka") || (url ?? "").includes("heureka"));
    const existing = byDomain.get(domain);
    if (!existing) {
      byDomain.set(domain, {
        category: category || "ine",
        domain,
        csvHeurekaUrl: isHeurekaUrl ? url.trim() : null,
      });
    } else if (!existing.csvHeurekaUrl && isHeurekaUrl) {
      existing.csvHeurekaUrl = url.trim();
    }
  }
  return [...byDomain.values()];
}

async function headOk(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(HEAD_TIMEOUT_MS),
      headers: { "User-Agent": "Zlavickovo/1.0 feed-discovery" },
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function parseUrl(url: string, category: string) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(GET_TIMEOUT_MS),
    headers: { "User-Agent": "Zlavickovo/1.0 (+https://zlavickovo.sk)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) throw new Error(`too big (${buf.byteLength} B)`);
  const xml = new TextDecoder().decode(buf);
  return parseHeurekaXmlDetailed(xml, category, {});
}

async function findFeed(row: Row): Promise<{ url: string; products: number; eanPct: number } | null> {
  const tryUrls: string[] = [];
  if (row.csvHeurekaUrl) tryUrls.push(row.csvHeurekaUrl);
  for (const p of PATTERNS) tryUrls.push(p(row.domain));

  for (const url of tryUrls) {
    // exact CSV url skúšame rovno GET (HEAD niektoré feed enginy neponúkajú)
    const isCsv = url === row.csvHeurekaUrl;
    if (!isCsv && !(await headOk(url))) continue;
    try {
      const parsed = await parseUrl(url, row.category);
      const n = parsed.products.length;
      if (parsed.status === "success" && n > 0) {
        const withEan = parsed.products.filter((p) => p.ean).length;
        return { url, products: n, eanPct: Math.round((withEan / n) * 100) };
      }
    } catch {
      // skús ďalší vzor
    }
  }
  return null;
}

async function main() {
  const rows = loadRows();
  console.log(`Obchodov mimo HEUREKA_FEEDS na preskúmanie: ${rows.length}\n`);

  const found: { row: Row; hit: { url: string; products: number; eanPct: number } }[] = [];
  for (const row of rows) {
    const hit = await findFeed(row);
    if (hit) {
      found.push({ row, hit });
      console.log(
        `OK ${row.domain.padEnd(30)} ${row.category.padEnd(10)} produkty=${String(hit.products).padStart(5)} EAN=${hit.hit?.eanPct ?? hit.eanPct}%  ${hit.url}`
      );
    } else {
      console.log(`-- ${row.domain.padEnd(30)} ${row.category.padEnd(10)} (žiadny validný Heureka feed)`);
    }
  }

  console.log(`\n=== ${found.length}/${rows.length} nových Heureka feedov nájdených ===`);
  console.log("\n--- Kandidáti na pridanie do feeds.ts ---");
  for (const { row, hit } of found) {
    console.log(`${row.domain}\t${row.category}\t${hit.url}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
